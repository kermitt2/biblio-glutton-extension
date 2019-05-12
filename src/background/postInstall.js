'use strict';

function handleInstalled(details) {
  console.log(details.reason);
  if (details.reason === 'install') {
    chrome.tabs.create({
      url: chrome.runtime.getURL('/options/options.html')
    });
  }
}

chrome.runtime.onInstalled.addListener(handleInstalled);