/*
 * @prettier
 */
'use strict';

function handleInstalled(details) {
  if (details.reason === 'install') {
    chrome.storage.local.clear(function() {
      if (!chrome.runtime.lastError) {
        return chrome.storage.local.set(DEFAULT_OPTIONS, function() {
          if (chrome.runtime.lastError) alert('error chrome.storage.local.set', chrome.runtime.lastError);
        });
      }
      if (chrome.runtime.lastError) alert('error chrome.storage.local.get', chrome.runtime.lastError);
    });
  }

  return chrome.tabs.create({
    url: chrome.runtime.getURL('/options/options.html')
  });
}

chrome.runtime.onInstalled.addListener(handleInstalled);
