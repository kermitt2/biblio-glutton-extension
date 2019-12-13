/*
 * @prettier
 */
'use strict';

let openTabQuery = { 'active': true, 'currentWindow': true };

$(document).ready(function() {
  return chrome.tabs.query(openTabQuery, function(tabs) {
    // Click on preferences button
    $('#settings').click(function() {
      return chrome.runtime.openOptionsPage(function() {
        if (chrome.runtime.lastError) alert('error chrome.runtime.openOptionsPage', chrome.runtime.lastError);
        console.log('Options page opened');
      });
    });

    $('#debug').text('#' + tabs[0].id + ' - ' + new Date().toLocaleString());

    chrome.tabs.sendMessage(tabs[0].id, { 'message': 'fromPopupToContentScript:ping' });
    return chrome.tabs.sendMessage(tabs[0].id, { 'message': 'fromPopupToContentScript:refreshGluttonUI' });
  });
});

// listeners
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  console.log(request, sender);
  if (request.message === 'fromContentScriptToPopup:refreshGluttonUI') return refreshGluttonUI(request.data);
  else if (request.message === 'fromContentScriptToPopup:refreshRefbibsCount') return refreshRefbibsCount(request.data);
  else if (request.message === 'fromContentScriptToPopup:refreshResolveStats') return refreshResolveStats(request.data);
  else if (request.message === 'fromContentScriptToPopup:pong') {
    hideErrorMsg();
    return showStats();
  }
});

function showStats() {
  return $('#popup-footer').show();
}

function hideErrorMsg() {
  return $('#error-msg').text('');
}

// Refresh refbibs count value
function refreshRefbibsCount(count) {
  if (typeof count !== 'undefined') return $('#refbibs-count').text(count);
}
// Refresh calls services statistics
function refreshResolveStats(stats) {
  $('#resolve-count').text(stats.count);
  $('#resolve-fail-count').text(stats.fail);
  $('#resolve-success-count').text(stats.success);
}

// Refresh Glutton UI
function refreshGluttonUI(data) {
  let checkData = typeof data === 'object' && data,
    count = checkData && typeof data.refbibs === 'object' && data.refbibs ? data.refbibs.count : undefined,
    stats = checkData ? data.stats : {};
  refreshRefbibsCount(count);
  refreshResolveStats(stats);
}
