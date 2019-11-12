/*
 * @prettier
 */
'use strict';

const DEFAULT = {
  'SHOW_ISTEX': false,
  'GROBID_URL': 'http://localhost:8070/api',
  // 'GROBID_URL': 'http://cloud.science-miner.com/grobid/api',
  'GLUTTON_URL': 'http://cloud.science-miner.com/glutton/service'
};

function handleInstalled(details) {
  if (details.reason === 'install') {
    if (typeof browser !== 'undefined') {
      let clearStorage = browser.storage.local.clear();
      clearStorage.then(
        function() {
          return browser.storage.local.set(DEFAULT);
        },
        function() {
          alert('browser.storage.local.clear error');
        }
      );
    } else {
      chrome.storage.local.clear(function() {
        if (!chrome.runtime.lastError) {
          return chrome.storage.local.set(DEFAULT, function() {
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
}

chrome.runtime.onInstalled.addListener(handleInstalled);
