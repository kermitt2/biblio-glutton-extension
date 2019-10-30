/*
 * @prettier
 */
'use strict';

var whiteList = [
    'scholar.google.*',
    '*.wikipedia.org',
    'scholar.*.fr',
    '*' // Until we get better and/or configurable whitelist
  ],
  whiteListPatterns = whiteList.map(compileUrlPattern);
let cache = {};

/*
Create all the context menu items.
*/
browser.contextMenus.create(
  {
    id: 'resolve',
    title: 'Resolve',
    contexts: ['selection']
  },
  onCreated
);

browser.contextMenus.create(
  {
    id: 'cite',
    title: 'Cite this paper',
    contexts: ['link']
  },
  onCreated
);

browser.contextMenus.onClicked.addListener(function(info, tab) {
  if (info.menuItemId == 'resolve') browser.tabs.sendMessage(tab.id, { 'message': 'resolve', 'data': info });
  if (info.menuItemId == 'cite') browser.tabs.sendMessage(tab.id, { 'message': 'cite', 'data': info });
});

browser.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.message === 'addRefbib') {
    return browser.tabs.sendMessage(sender.tab.id, { 'message': request.message, 'data': request.data });
  }
});

browser.runtime.onConnect.addListener(function(port) {
  port.onMessage.addListener(function(page) {
    if (!isContentTypeAllowed(page.contentType) || !isWhiteListed(port.sender.url)) return;
    // browser.tabs.executeScript(port.sender.tab.id, {file: '/vendors/jquery-3.2.1.js'});
    browser.tabs.executeScript(port.sender.tab.id, { file: '/vendors/lz-string.js' });
    browser.tabs.executeScript(port.sender.tab.id, { file: '/content_scripts/log.js' });
    //browser.tabs.executeScript(port.sender.tab.id, {file: '/content_scripts/storage.js'});
    browser.tabs.executeScript(port.sender.tab.id, { file: '/content_scripts/main.js' });
  });
});

function isContentTypeAllowed(contentType) {
  var forbidenContentTypes = [/application\/(\w+\+)?xml/, /text\/xml/];
  return !forbidenContentTypes.find(function(regex) {
    return contentType.match(regex);
  });
}

function isWhiteListed(url) {
  for (var i = 0; i < whiteListPatterns.length; ++i) {
    if (url.match(whiteListPatterns[i])) {
      return true;
    }
  }
  return false;
}

function escapeStringForRegex(str) {
  return str.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
}

function compileUrlPattern(url) {
  return new RegExp(escapeStringForRegex(url).replace('\\*', '.*'), 'i');
}

/*
Called when the item has been created, or when creation failed due to an error.
We'll just log success/failure here.
*/
function onCreated() {
  if (browser.runtime.lastError) {
    console.log(`Error: ${browser.runtime.lastError}`);
  } else {
    console.log('Item created successfully');
  }
}

/*
Called when the item has been removed.
We'll just log success here.
*/
function onRemoved() {
  console.log('Item removed successfully');
}

/*
Called when there was an error.
We'll just log the error here.
*/
function onError(error) {
  console.log(`Error: ${error}`);
}
