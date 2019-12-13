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

let XMLS = new XMLSerializer();

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
  } else if (
    request.message === 'fromGluttonLinkInserterToBackground:openTab' ||
    request.message === 'fromContentScriptToBackground:openTab'
  ) {
    return chrome.tabs.create({ 'url': request.data.url });
  } else if (request.message === 'fromContentScriptToBackground:parseReference') {
    let response = buildResponse(request.message),
      result = { 'refbib': { 'gluttonId': request.data.gluttonId } };
    // Call GROBID service (processCitation)
    return callGrobidService(
      'processCitation',
      request.data.services.processCitation,
      {
        'merge': xmlGrobidMerge,
        'message': response.message,
        'mute': true,
        'service': 'processCitation',
        'tabId': sender.tab.id
      },
      result,
      function(res) {
        // Call Glutton service (lookup)
        return callGluttonService(
          {
            'url': buildUrl(request.data.services.lookup.url, extractLookupParams(res.refbib.processCitation))
          },
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
      result = { 'refbib': { 'gluttonId': request.data.gluttonId } },
      blob;
    // Donwload PDF file
    return callPdfService(
      request.data.input,
      {
        'merge': function(result) {
          blob = result.blob;
          return {
            'refbib': { 'pdf': { 'url': request.data.input, 'data': result.data } }
          };
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
          { 'url': request.data.services.processHeaderDocument.url, 'input': blob },
          {
            'merge': xmlGrobidMerge,
            'message': response.message,
            'mute': true,
            'service': 'processHeaderDocument',
            'tabId': sender.tab.id
          },
          res,
          function(res) {
            // Call GROBID service (referenceAnnotations)
            return callGrobidService(
              'referenceAnnotations',
              { 'url': request.data.services.referenceAnnotations.url, 'input': blob },
              {
                'merge': function(result, service) {
                  let res = { 'refbib': {} };
                  res.refbib[service] = result;
                  return res;
                },
                'message': response.message,
                'service': 'referenceAnnotations',
                'tabId': sender.tab.id
              },
              res
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
      _res.refbib.services[options.service] = { 'err': err, 'res': sanitizeResultOf(options.service, res) };
    }
    if (err) {
      result = $.extend(true, _res, result, { 'error': res });
      console.log(SERVICE, options, result, _res);
      return chrome.tabs.sendMessage(options.tabId, {
        'message': options.message,
        'data': {
          'err': err,
          'res': result
        }
      });
    } else {
      if (typeof options.merge === 'function') result = $.extend(true, _res, result, options.merge(res, SERVICE.route));
      else result = $.extend(true, _res, result, { 'refbib': res });
    }
    if (typeof options.mute === 'undefined' || !options.mute) {
      chrome.tabs.sendMessage(options.tabId, {
        'message': options.message,
        'data': {
          'err': err,
          'res': result
        }
      });
    }
    console.log(SERVICE, options, _res, result);
    if (typeof cb !== 'undefined') return cb(result);
  });
}

function sanitizeResultOf(service, res) {
  if (service === 'processHeaderDocument' || service === 'processCitation') return null;
  else return res;
}

// Call PDF service
function callPdfService(url, options, result, cb) {
  return callService(
    { 'name': 'FILE', 'route': 'getPDF' },
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
      result += '&sid=glutton-browser-addon';
    }
  }
  return encodeURI(result);
}

// Extract data from GROBID response
function extractLookupParams(data) {
  return {
    'postValidate': 'true',
    'firstAuthor': data.author && data.author.length > 0 && data.author[0] ? data.author[0].surname : undefined, // firstAuthor
    'atitle': data.atitle ? data.atitle.text : undefined, // atitle
    'jtitle': data.jtitle ? data.jtitle.text : undefined, // jtitle
    'volume': data.biblScope ? data.biblScope.volume : undefined, // volume
    'firstPage': data.biblScope ? data.biblScope.from : undefined, // firstPage
    'doi': data.DOI || undefined, // doi
    'pii': data.PII || undefined, // doi
    'pmid': data.PMID || undefined, // pmid
    'pmc': data.PMC || undefined, // pmc
    'istexid': data.istexId || undefined // istexid
  };
}

// Extract data from GROBID response
function extractDataFromGrobidXML(element) {
  let root = $(element);
  let result = {
    'atitle': {
      'text': root.find('biblStruct > analytic > title[level="a"]').text(),
      'main': root.find('biblStruct > analytic > title[level="a"][type="main"]').text(),
      'abbrev': root.find('biblStruct > analytic > title[level="a"][type="abbrev"]').text()
    },
    'jtitle': {
      'text': root.find('biblStruct > monogr > title[level="j"]').text(),
      'main': root.find('biblStruct > monogr > title[level="j"][type="main"]').text(),
      'abbrev': root.find('biblStruct > monogr > title[level="j"][type="abbrev"]').text()
    },
    'mtitle': {
      'text': root.find('biblStruct > monogr > title[level="m"]').text(),
      'main': root.find('biblStruct > monogr > title[level="m"][type="main"]').text(),
      'abbrev': root.find('biblStruct > monogr > title[level="m"][type="abbrev"]').text()
    },
    'DOI': root.find('biblStruct > analytic > idno[type="DOI"]').text(),
    'PMID': root.find('biblStruct > analytic > idno[type="PMID"]').text(),
    'PII': root.find('biblStruct > analytic > idno[type="PII"]').text(),
    'ark': root.find('biblStruct > analytic > idno[type="ark"]').text(),
    'istexId': root.find('biblStruct > analytic > idno[type="istexId"]').text(),
    'ISBN': root.find('biblStruct > analytic > idno[type="ISBN"]').text(),
    'ISSN': root.find('biblStruct > monogr > idno[type="ISSN"]').text(),
    'ISSNe': root.find('biblStruct > monogr > idno[type="ISSNe"]').text(),
    'jtitle': {
      'text': root.find('biblStruct > monogr > title[level="j"]').text(),
      'main': root.find('biblStruct > monogr > title[level="j"][type="main"]').text(),
      'abbrev': root.find('biblStruct > monogr > title[level="j"][type="abbrev"]').text()
    },
    'biblScope': {
      'volume': root.find('biblStruct > monogr > imprint > biblScope[unit="volume"]').text(),
      'issue': root.find('biblStruct > monogr > imprint > biblScope[unit="issue"]').text(),
      'from': root.find('biblStruct > monogr > imprint > biblScope[unit="page"]').attr('from'),
      'to': root.find('biblStruct > monogr > imprint > biblScope[unit="page"]').attr('to')
    },
    'published': root.find('biblStruct > monogr > imprint > date[type="published"]').attr('when'),
    'open-access': root.find('biblStruct > analytic > ptr[type="open-access"]').attr('target'),
    'addrLine': root.find('biblStruct > monogr > meeting > address > addrLine').text(),

    'author': root
      .find('biblStruct > analytic > author')
      .map(function() {
        return {
          'first': $(this)
            .find('persName > forename[type="first"]')
            .text(),
          'middle': $(this)
            .find('persName > forename[type="middle"]')
            .text(),
          'surname': $(this)
            .find('persName > surname')
            .text()
        };
      })
      .get(),
    'orgName': root.find('biblStruct > monogr > respStmt > orgName').text()
  };
  return result;
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

// Build response of GROBID service when result is an xml
function xmlGrobidMerge(result, service) {
  let res = { 'refbib': {} };
  res.refbib[service] = extractDataFromGrobidXML(result);
  return res;
}

// Build response of GROBID service when result is an xml
function xmlToString(xmlObject) {
  return XMLS.serializeToString(result);
}
