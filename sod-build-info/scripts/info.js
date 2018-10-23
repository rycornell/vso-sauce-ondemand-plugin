/* eslint-env jquery, browser, es6 */
/* global VSS */
require('babel-polyfill');
const TaskAgentRestClient = require('TFS/DistributedTask/TaskAgentRestClient');
const TaskRestClient = require('TFS/DistributedTask/TaskRestClient');
//require('text-encoding');

const webContext = VSS.getWebContext();
const taskAgentRestClient = TaskAgentRestClient.getClient();
const taskRestClient = TaskRestClient.getClient();
const sharedConfig = VSS.getConfiguration();

sharedConfig.onBuildChanged(async function(build) {
  try {
    const taskAttachments = await taskRestClient.getPlanAttachments(
      webContext.project.id,
      'build',
      build.orchestrationPlan.planId,
      'SauceLabsBuildResult'
    );
    const buildInformation = await taskRestClient.getAttachmentContent(
      webContext.project.id,
      'build',
      build.orchestrationPlan.planId,
      taskAttachments[0].timelineId,
      taskAttachments[0].recordId,
      taskAttachments[0].type,
      taskAttachments[0].name
    )
      .then(arrayBuffer => new window.TextDecoder('UTF-8').decode(arrayBuffer))
      .then(str => JSON.parse(str));

    const buildFullJobs = await taskAgentRestClient.executeServiceEndpointRequest(
      {
        'dataSourceDetails': {
          dataSourceName: 'getBuildFullJobs',
          parameters: {
            build: buildInformation.SAUCE_BUILD_NAME,
            username: buildInformation.SAUCE_USERNAME
          }
        }
      },
      webContext.project.id,
      buildInformation.CONNECTED_SERVICE_NAME
    )
      .then(result => {
        if (result.errorMessage) { throw result.errorMessage; }
        return result.result[0];
      })
      .then(str => JSON.parse(str).jobs);
    const authResults = await taskAgentRestClient.executeServiceEndpointRequest(
      {
        'dataSourceDetails': {
          dataSourceName: 'getAuth',
          parameters: {
            query: `jobIds=${buildFullJobs.map(j => j.id)}`,
            build: buildInformation.SAUCE_BUILD_NAME,
            username: buildInformation.SAUCE_USERNAME
          }
        }
      },
      webContext.project.id,
      buildInformation.CONNECTED_SERVICE_NAME
    )
      .then(result => {
        if (result.errorMessage) { throw result.errorMessage; }
        return result.result[0];
      })
      .then(str => JSON.parse(str).results);

    const $table = $('<table>');
    $table.css('min-width', '800px');
    $table.append('<thead><tr><th align="left">Job Name</th><th align="left">OS/Browser</th><th align="left">Pass/Fail</th><th align="left">Job Links</th></tr></thead>');
    buildFullJobs.forEach(job => {
      const auth = authResults.shift();
      const videoHref = auth['video'].replace('saucelabs.com', 'assets.saucelabs.com').replace('.flv','.mp4');
      const logsHref = auth['selenium-server.log'].replace('saucelabs.com', 'assets.saucelabs.com');
      const $tr = $('<tr>');
      $tr.append($('<td>').text(job.name));
      $tr.append($('<td>').text(job.os + ' ' + job.browser));
      $tr.append($('<td>').text(job.consolidated_status));
      $tr.append(
        $('<td>')
          .append($('<a download>').attr('href', videoHref).text('Video'))
          .append(' - ')
          .append($('<a download>').attr('href', logsHref).text('Logs'))
      );
      $table.append($tr);
    });
    const $buildinfo = $('.build-info').empty();
    $buildinfo.css('height','400px');
    $buildinfo.css('overflow','auto');
    $buildinfo.append('<h2>Sauce Labs results</h2>').append($table);
  } catch (err) {
    console.error('error', err);
  }
});
/*

const VSS_Auth_Service = require('VSS/Authentication/Services');
VSS.getAccessToken().then(function(token){
  // Format the auth header
  var authHeader = VSS_Auth_Service.authTokenManager.getAuthorizationHeader(token);

  // Add token as an Authorization header to your request
  console.log('authHeader', authHeader);
});

VSS.getAppToken().then(token => {
  console.log('User token is', token);
});

*/
