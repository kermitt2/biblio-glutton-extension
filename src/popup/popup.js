/*
 * @prettier
 */
'use strict';

let openTabQuery = { 'active': true, 'currentWindow': true },
  dataView = {
    'keys': ['atitle', 'firstAuthor', 'oaLink', 'istexLink'],
    'data': {
      'atitle': { 'label': 'Title', 'type': 'text' },
      'firstAuthor': { 'label': 'First Author', 'type': 'text' },
      'istexLink': { 'label': 'ISTEX', 'type': 'href' },
      'oaLink': { 'label': 'Open Access', 'type': 'href' },
      'gluttonId': { 'label': 'GluttonId', 'type': 'text' }
    }
  },
  currentRefbib = undefined;

$(document).ready(function() {
  return chrome.tabs.query(openTabQuery, function(tabs) {
    // Click on preferences button
    $('#settings').click(function() {
      return chrome.runtime.openOptionsPage(function() {
        if (chrome.runtime.lastError) alert('error chrome.runtime.openOptionsPage', chrome.runtime.lastError);
        console.log('Options page opened');
      });
    });

    // Click on processPdf button
    $('#processPdf').click(function() {
      return chrome.tabs.sendMessage(tabs[0].id, { 'message': 'fromPopupToContentScript:processPdf' });
    });

    // Click on openUrl button
    $('#openUrl').click(function() {
      return chrome.tabs.create({ 'url': currentRefbib.oaLink });
    });

    // Click on cite button
    $('#processCite').click(function() {
      let citeType = $('#citeType > input:checked')
        .first()
        .attr('value');
      return buildCite(citeType, currentRefbib);
    });

    // Click on copy button
    $('#processCopy').click(function() {
      return copyClipboard($('#citeString > input').val());
    });

    $('#debug').text('#' + tabs[0].id + ' - ' + new Date().toLocaleString());

    return chrome.tabs.sendMessage(tabs[0].id, { 'message': 'fromPopupToContentScript:refreshGluttonUI' });
  });
});

// listeners
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  console.log(request, sender);
  if (request.message === 'fromContentScriptToPopup:refreshGluttonUI') return refreshGluttonUI(request.data);
  else if (request.message === 'fromContentScriptToPopup:refreshRefbibsCount') return refreshRefbibsCount(request.data);
  else if (request.message === 'fromContentScriptToPopup:refreshProcessPdfButton')
    return refreshProcessPdfButton(request.data);
  else if (request.message === 'fromContentScriptToPopup:refreshOpenUrl') return refreshOpenUrl(request.data);
  else if (request.message === 'fromContentScriptToPopup:refreshRefbib') return refreshRefbib(request.data);
});

// Refresh refbib data values
function refreshRefbib(refbib) {
  currentRefbib = refbib;
  return setRefbib(currentRefbib);
}

// Refresh openUrl button state
function refreshOpenUrl(state) {
  if (state) $('#openUrl').show();
  else $('#openUrl').hide();
  if (typeof state !== 'undefined') return $('#openUrl').attr('disabled', !state);
}

// Refresh processPdf button state
function refreshProcessPdfButton(state) {
  if (state) $('#processPdf').show();
  else $('#processPdf').hide();
  if (typeof state !== 'undefined') return $('#processPdf').attr('disabled', !state);
}

// Refresh refbibs count value
function refreshRefbibsCount(count) {
  if (typeof count !== 'undefined') return $('#refbibs-count').text(count);
}

// Refresh refbib cite div
function refreshRefbibCite(state) {
  if (state) {
    $('#popup-footer').show();
    $('#processCite').show();
  } else {
    $('#popup-footer').hide();
    $('#processCite').hide();
  }
  if (typeof state !== 'undefined') return $('#processCite').attr('disabled', !state);
}

// Refresh Glutton UI
function refreshGluttonUI(data) {
  let checkData = typeof data === 'object' && data,
    checkRefbib = checkData && typeof data.refbib === 'object' && data.refbib,
    count = checkData && typeof data.refbibs === 'object' && data.refbibs ? data.refbibs.count : undefined,
    oaLink = checkData && checkRefbib ? data.refbib.oaLink : undefined,
    processPdf = checkData ? data.processPdf : undefined,
    refbib = checkData && checkRefbib ? data.refbib : undefined;
  // console.log(count, oaLink, processPdf, refbib);
  refreshRefbibsCount(count);
  refreshOpenUrl(oaLink);
  refreshProcessPdfButton(processPdf);
  refreshRefbib(refbib);
  refreshRefbibCite(refbib && refbib.publisher);
}

// Set refbib values into popup HTML
function setRefbib(refbib) {
  let container = $('#refbib');
  if (typeof refbib === 'undefined') {
    container.text('Click on glutton button to show details');
    return $('#popup-footer').hide();
  }
  container.empty();
  $('#popup-footer').show();
  for (let i = 0; i < dataView.keys.length; i++) {
    let key = dataView.keys[i];
    if (typeof refbib[key] !== 'undefined' && refbib[key] !== null)
      container.append(buildData(dataView.data[key], refbib[key]));
  }
  if (container.find('.data-row').length === 0) container.text('There is no data available');
}

// Build HTML representation of data
function buildData(key, value) {
  let container = $('<div>').addClass('data-row'),
    keyDiv = buildElement('text', key.label, 'key'),
    valueDiv = buildElement(key.type, value, 'value');
  return container.append(keyDiv).append(valueDiv);
}

// build an element
function buildElement(type, value, className) {
  if (type === 'text')
    return $('<div>')
      .addClass(className)
      .text(value);
  else if (type === 'href')
    return $('<a>')
      .addClass(className)
      .attr('href', value)
      .text(value);
}

// Build cite
function buildCite(citeType, refbib) {
  let txt = CITE[citeType](refbib);
  return $('#citeString > input').val(txt);
}

// Copy to to clipboard the given text
function copyClipboard(text) {
  navigator.clipboard.writeText(text).then(
    function() {
      alert('Text copied in the clipboard');
    },
    function() {
      alert('Copy in clipboard failed');
    }
  );
}
