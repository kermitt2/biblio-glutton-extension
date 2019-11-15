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
  console.log(request);
  if (request.message === 'fromGluttonLinkInserterToBackground:lookup') {
    $.ajax({
      'url': request.data.url,
      'timeout': 16000,
      'tryCount': 0,
      'maxRetry': 1,
      'success': function(data) {
        chrome.tabs.sendMessage(sender.tab.id, {
          'message': 'fromBackgroundToGluttonLinkInserter:lookup',
          'err': false,
          'res': {
            'gluttonId': request.data.gluttonId,
            'url': request.data.url,
            'oaLink': data.oaLink,
            'istexLink': data.istexLink
          }
        });
      },
      'error': function(jqXHR, textStatus, errorThrown) {
        chrome.tabs.sendMessage(sender.tab.id, {
          'message': 'fromBackgroundToGluttonLinkInserter:lookup',
          'err': true,
          'res': {
            'gluttonId': request.data.gluttonId,
            'errorThrown': errorThrown,
            'textStatus': textStatus,
            'url': this.url
          }
        });
        if (textStatus === 'timeout' && this.tryCount < this.maxRetry) {
          this.tryCount++;
          return $.ajax(this);
        }
      }
    });
  } else if (request.message === 'fromContentScriptToBackground:referenceAnnotations') {
    return $.ajax({
      'url': request.data.input,
      'timeout': 16000,
      'method': 'GET',
      'xhrFields': {
        'responseType': 'blob'
      }
    })
      .done(function(pdf) {
        let formData = new FormData();
        formData.append('input', pdf);
        return (
          $.ajax({
            'url': request.data.processHeaderDocumentUrl,
            'timeout': 16000,
            'method': request.data.method,
            'data': formData,
            'dataType': 'xml',
            'cache': false,
            'contentType': false,
            'processData': false
          })
            .done(function(res) {
              let parameters = extractParams(res.documentElement),
                url = buildUrl(request.data.lookupUrl, parameters);
              return callGluttonLookup(url, request.data.gluttonId, function(err, res) {
                return chrome.tabs.sendMessage(sender.tab.id, {
                  'message': 'fromBackgroundToContentScript:processHeaderDocument',
                  'data': {
                    'err': err,
                    'res': res
                  }
                });
              });
            })
            // call referenceAnnotationsUrl
            .always(function(res) {
              return $.ajax({
                'url': request.data.referenceAnnotationsUrl,
                'timeout': 16000,
                'method': request.data.method,
                'data': formData,
                'dataType': request.data.dataType,
                'cache': false,
                'contentType': false,
                'processData': false
              })
                .done(function(res) {
                  return chrome.tabs.sendMessage(sender.tab.id, {
                    'message': 'fromBackgroundToContentScript:referenceAnnotations',
                    'data': {
                      'err': false,
                      'res': res
                    }
                  });
                })
                .fail(function(res) {
                  let msg =
                    res.status > 0
                      ? res.status + ' : ' + res.statusText
                      : 'Unable to send request to : ' +
                        request.data.referenceAnnotationsUrl +
                        '. Service not responding.';
                  return chrome.tabs.sendMessage(sender.tab.id, {
                    'message': 'fromBackgroundToContentScript:referenceAnnotations',
                    'data': {
                      'err': true,
                      'res': msg
                    }
                  });
                });
            })
            .fail(function(res) {
              let msg =
                res.status > 0
                  ? res.status + ' : ' + res.statusText
                  : 'Unable to send request to : ' +
                    request.data.processCitationPatentPDFUrl +
                    '. Service not responding.';
              return chrome.tabs.sendMessage(sender.tab.id, {
                'message': 'fromBackgroundToContentScript:processCitationPatentPDF',
                'data': {
                  'err': true,
                  'res': msg
                }
              });
            })
        );
      })
      .fail(function(res) {
        let msg =
          res.status > 0
            ? res.status + ' : ' + res.statusText
            : 'Unable to send request to : ' + request.data.input + '. Service not responding.';
        return chrome.tabs.sendMessage(sender.tab.id, {
          'message': 'fromBackgroundToContentScript:referenceAnnotations',
          'data': {
            'err': true,
            'res': msg
          }
        });
      });
  } else if (request.message === 'fromContentScriptToBackground:resolve') {
    return $.ajax({
      'url': request.data.processCitationUrl,
      'timeout': 16000,
      'method': request.data.method,
      'data': request.data.data,
      'dataType': request.data.dataType
    })
      .done(function(res) {
        let parameters = extractParams(res.documentElement),
          url = buildUrl(request.data.lookupUrl, parameters);
        return callGluttonLookup(url, request.data.gluttonId, function(err, res) {
          return chrome.tabs.sendMessage(sender.tab.id, {
            'message': 'fromBackgroundToContentScript:resolve',
            'data': {
              'err': err,
              'res': res
            }
          });
        });
      })
      .fail(function(res) {
        let msg =
          res.status > 0
            ? res.status + ' : ' + res.statusText
            : 'Unable to send request to : ' + request.data.processCitationUrl + '. Service not responding.';
        return chrome.tabs.sendMessage(sender.tab.id, {
          'message': 'fromBackgroundToContentScript:resolve',
          'data': {
            'err': true,
            'res': msg
          }
        });
      });
  } else if (request.message === 'fromGluttonLinkInserterToBackground:addRefbib') {
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
  });
});

function callGluttonLookup(url, gluttonId, cb) {
  return $.get(url)
    .done(function(res) {
      res.gluttonId = gluttonId;
      return cb(false, res);
    })
    .fail(function(res) {
      let msg =
        res.status > 0
          ? res.status + ' : ' + res.statusText
          : 'Unable to send request to : ' + url + '. Service not responding.';
      return cb(true, msg);
    });
}

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
