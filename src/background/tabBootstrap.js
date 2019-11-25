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

/*
Create all the context menu items.
*/
chrome.contextMenus.create(
  {
    id: 'parseReference',
    title: 'Parse reference',
    contexts: ['selection']
  },
  onCreated
);

chrome.contextMenus.create(
  {
    id: 'cite',
    title: 'Cite this paper',
    contexts: ['link']
  },
  onCreated
);

chrome.contextMenus.onClicked.addListener(function(info, tab) {
  console.log(info, tab);
  if (info.menuItemId === 'parseReference')
    return chrome.tabs.sendMessage(tab.id, { 'message': 'fromContextMenusToContentScript:parseReference' });
  else if (info.menuItemId === 'cite') {
    if (typeof browser !== 'undefined') return browser.browserAction.openPopup();
    return chrome.tabs.sendMessage(tab.id, { 'message': 'fromContextMenusToContentScript:cite', 'data': info });
  }
});

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  console.log(request, sender);
  if (
    request.message === 'fromGluttonLinkInserterToBackground:oa/oa_istex' ||
    request.message === 'fromContentScriptToBackground:oa/oa_istex' ||
    request.message === 'fromGluttonLinkInserterToBackground:lookup' ||
    request.message === 'fromContentScriptToBackground:lookup'
  ) {
    let response = buildResponse(request.message),
      result = { 'refbib': { 'gluttonId': request.data.gluttonId } };
    // Call Glutton service (oa/oa_istex OR lookup)
    return callGluttonService(
      request.data.services[response.right],
      {
        'merge': lookupMerge,
        'message': response.message,
        'service': response.right,
        'tabId': sender.tab.id
      },
      result
    );
  } else if (request.message === 'fromContentScriptToBackground:parseReference') {
    let response = buildResponse(request.message),
      result = { 'refbib': { 'gluttonId': request.data.gluttonId } };
    // Call GROBID service (processCitation)
    return callGrobidService(
      'processCitation',
      request.data.services.processCitation,
      { 'message': response.message, 'mute': true, 'service': 'processCitation', 'tabId': sender.tab.id },
      result,
      function(res) {
        // Call Glutton service (lookup)
        return callGluttonService(
          { 'url': buildUrl(request.data.services.lookup.url, res.refbib.services.processCitation.res) },
          {
            'merge': lookupMerge,
            'message': response.message,
            'service': 'lookup',
            'tabId': sender.tab.id
          },
          res
        );
      }
    );
  } else if (request.message === 'fromContentScriptToBackground:processPdf') {
    let response = buildResponse(request.message),
      result = { 'refbib': { 'gluttonId': request.data.gluttonId } };
    // Donwload PDF file
    return callFileService(
      request.data.input,
      {
        'merge': function(result) {
          return { 'refbib': { 'pdf': { 'blob': result, 'url': request.data.input } } };
        },
        'message': response.message,
        'mute': true,
        'tabId': sender.tab.id
      },
      result,
      function(res) {
        // Call GROBID service (processHeaderDocument)
        return callGrobidService(
          'processHeaderDocument',
          { 'url': request.data.services.processHeaderDocument.url, 'input': res.refbib.pdf.blob },
          { 'message': response.message, 'mute': true, 'service': 'processHeaderDocument', 'tabId': sender.tab.id },
          res,
          function(res) {
            // Call GROBID service (referenceAnnotations)
            return callGrobidService(
              'referenceAnnotations',
              { 'url': request.data.services.referenceAnnotations.url, 'input': res.refbib.pdf.blob },
              { 'message': response.message, 'mute': true, 'service': 'referenceAnnotations', 'tabId': sender.tab.id },
              res,
              function(res) {
                // Call Glutton service (lookup)
                return callGluttonService(
                  { 'url': buildUrl(request.data.services.lookup.url, res.refbib.services.processHeaderDocument.res) },
                  {
                    'merge': lookupMerge,
                    'message': response.message,
                    'service': 'lookup',
                    'tabId': sender.tab.id
                  },
                  res
                );
              }
            );
          }
        );
      }
    );
  }
});

chrome.runtime.onConnect.addListener(function(port) {
  return port.onMessage.addListener(function(page) {
    if (!isContentTypeAllowed(page.contentType) || !isWhiteListed(port.sender.url)) return;
    chrome.tabs.executeScript(port.sender.tab.id, { file: '/vendors/lz-string.js' });
    chrome.tabs.executeScript(port.sender.tab.id, { file: '/content_scripts/log.js' });
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

// transform request.message into response (message & route)
function buildResponse(message) {
  let split = message.split(':'),
    left = split[0],
    right = split[1];
  return {
    'message': 'fromBackgroundTo' + left.replace('from', '').replace('ToBackground', '') + ':' + right,
    'left': left,
    'right': right
  };
}

// Call a service -> assign result (default or custom way) -> send resoponse (unless mute)
// (send automatically response and do not call callback function in case of service error)
function callService(SERVICE, options, result, cb) {
  return SERVICES[SERVICE.name][SERVICE.route](options.parameters, function(err, res) {
    let _res = { 'refbib': {} };
    if (typeof options.service !== 'undefined') {
      _res.refbib.services = {};
      _res.refbib.services[options.service] = { 'err': err, 'res': res };
    }
    if (err) {
      result = $.extend(true, _res, result, { 'error': res });
      console.log(SERVICE, options, result, _res);
      return chrome.tabs.sendMessage(options.tabId, {
        'message': options.message,
        'data': {
          'err': err,
          'res': _res
        }
      });
    } else {
      if (typeof options.merge === 'function') result = $.extend(true, _res, result, options.merge(res));
      else result = $.extend(true, _res, result, { 'refbib': res });
    }
    if (typeof options.mute === 'undefined' || !options.mute) {
      chrome.tabs.sendMessage(options.tabId, {
        'message': options.message,
        'data': {
          'err': err,
          'res': _res
        }
      });
    }
    console.log(SERVICE, options, _res);
    if (typeof cb !== 'undefined') return cb(result);
  });
}

// Call file service
function callFileService(url, options, result, cb) {
  return callService(
    { 'name': 'FILE', 'route': 'get' },
    {
      'merge': options.merge,
      'message': options.message,
      'mute': options.mute,
      'parameters': { 'url': url },
      'tabId': options.tabId
    },
    result,
    cb
  );
}

// Call glutton service (lookup || oa/oa_istex)
function callGluttonService(url, options, result, cb) {
  return callService(
    { 'name': 'GLUTTON', 'route': 'get' },
    {
      'merge': options.merge,
      'message': options.message,
      'mute': options.mute,
      'parameters': url,
      'service': options.service,
      'tabId': options.tabId
    },
    result,
    cb
  );
}

// Call glutton service (lookup || oa/oa_istex)
function callGrobidService(route, parameters, options, result, cb) {
  return callService(
    { 'name': 'GROBID', 'route': route },
    {
      'merge': options.merge,
      'message': options.message,
      'mute': options.mute,
      'parameters': parameters,
      'service': options.service,
      'tabId': options.tabId
    },
    result,
    cb
  );
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

// Build istexLink after lookup call
function lookupMerge(result) {
  return $.extend(
    true,
    { 'refbib': result },
    {
      'refbib': {
        'istexLink':
          typeof result.istexId !== 'undefined'
            ? 'https://api.istex.fr/document/' + result.istexId + '/fulltext/pdf'
            : undefined
      }
    }
  );
}
