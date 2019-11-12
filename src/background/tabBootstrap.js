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
chrome.contextMenus.create(
  {
    id: 'resolve',
    title: 'Resolve',
    contexts: ['selection']
  },
  onCreated
);

chrome.contextMenus.create(
  {
    id: 'cite',
    title: 'Cite this paper (Bibtex)',
    contexts: ['link']
  },
  onCreated
);

chrome.contextMenus.onClicked.addListener(function(info, tab) {
  console.log(info, tab);
  if (info.menuItemId === 'resolve')
    return chrome.tabs.sendMessage(tab.id, { 'message': 'fromContextMenusToContentScript:resolve' });
  else if (info.menuItemId === 'cite')
    return chrome.tabs.sendMessage(tab.id, { 'message': 'fromContextMenusToContentScript:cite', 'data': info });
});

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.message === 'fromContentScriptToBackground:resolve') {
    console.log(request.data);
    return $.ajax({
      'url': request.data.processCitationUrl,
      'method': request.data.method,
      'data': request.data.data,
      'dataType': request.data.dataType
    })
      .done(function(res) {
        let parameters = extractParams(res.documentElement),
          url = buildUrl(request.data.lookupUrl, parameters);
        return $.get(url)
          .done(function(res) {
            res.gluttonId = request.data.gluttonId;
            return chrome.tabs.sendMessage(sender.tab.id, {
              'message': 'fromBackgroundToContentScript:resolve',
              'data': {
                'err': false,
                'res': res
              }
            });
          })
          .fail(function(res) {
            return chrome.tabs.sendMessage(sender.tab.id, {
              'message': 'fromBackgroundToContentScript:resolve',
              'data': {
                'err': true,
                'res': res
              }
            });
          });
      })
      .fail(function(res) {
        return chrome.tabs.sendMessage(sender.tab.id, {
          'message': 'fromBackgroundToContentScript:resolve',
          'data': {
            'err': true,
            'res': res.status + ' : ' + res.statusText
          }
        });
      });
  } else if (request.message === 'fromContentScriptToBackground:addRefbib') {
    return chrome.tabs.sendMessage(sender.tab.id, {
      'message': 'fromBackgroundToContentScript:addRefbib',
      'data': request.data
    });
  }
});

chrome.runtime.onConnect.addListener(function(port) {
  return port.onMessage.addListener(function(page) {
    if (!isContentTypeAllowed(page.contentType) || !isWhiteListed(port.sender.url)) return;
    chrome.tabs.executeScript(port.sender.tab.id, { file: '/vendors/lz-string.js' });
    chrome.tabs.executeScript(port.sender.tab.id, { file: '/content_scripts/log.js' });
    chrome.tabs.executeScript(port.sender.tab.id, { file: '/content_scripts/main.js' });
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
  if (chrome.runtime.lastError) {
    console.log(`Error: ${chrome.runtime.lastError}`);
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

// Extract data from GROBID response
function extractParams(element) {
  let root = $('<root/>').html($(element).html());
  return {
    'postValidate': 'true',
    'firstAuthor': root.find('author:first surname').text(), // firstAuthor
    'atitle': root.find('analytic title[level="a"]').text(), // atitle
    'jtitle': root.find('monogr title[level="j"]').text(), // jtitle
    'volume': root.find('biblscope[unit="volume"]').text(), // volume
    'firstPage': root.find('biblscope[unit="page"]').attr('from'), // firstPage
    'doi': root.find('idno[type="doi"]').text(), // doi
    'pmid': root.find('idno[type="pmid"]').text(), // pmid
    'pmc': root.find('idno[type="pmc"]').text(), // pmc
    'istexid': root.find('idno[type="istexid"]').text() // istexid
  };
}

// Build an URL with parameters
function buildUrl(baseUrl, parameters) {
  let result = baseUrl;
  if (typeof parameters === 'object') {
    let keys = Object.keys(parameters);
    if (keys.length > 0) {
      result += '?' + keys[0] + '=' + parameters[keys[0]];
      if (keys.length > 1) {
        for (let i = 1; i < keys.length; i++) {
          if (parameters[keys[i]]) result += '&' + keys[i] + '=' + parameters[keys[i]];
        }
      }
    }
  }
  return encodeURI(result);
}
