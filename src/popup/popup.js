/*
 * @prettier
 */
'use strict';

let openTabQuery = { 'active': true, 'currentWindow': true };

window.onload = function() {
  chrome.tabs.query(openTabQuery, function(tabs) {
    $('#debug').text('#' + tabs[0].id + ' - ' + new Date().toLocaleString());
  });
  refreshGluttonList();
  refreshGrobidBtn();
};

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.message === 'fromContentScriptToPopup:gluttonList') return buildGluttonList(request.data);
  else if (request.message === 'fromContentScriptToPopup:grobidBtn') return buildGrobidBtn(request.data);
});

$('#preferences').click(function() {
  return chrome.runtime.openOptionsPage(function() {
    if (chrome.runtime.lastError) alert('error chrome.runtime.openOptionsPage', chrome.runtime.lastError);
    console.log('Options page opened');
  });
});

$('#grobid').click(function() {
  chrome.tabs.query(openTabQuery, function(tabs) {
    chrome.tabs.sendMessage(tabs[0].id, { 'message': 'fromPopupToContentScript:referenceAnnotations' });
  });
});

function defaultCallback(res) {
  alert(res);
}

function refreshGrobidBtn() {
  chrome.tabs.query(openTabQuery, function(tabs) {
    chrome.tabs.sendMessage(tabs[0].id, { 'message': 'fromPopupToContentScript:grobidBtn' });
  });
}

function refreshGluttonList() {
  chrome.tabs.query(openTabQuery, function(tabs) {
    chrome.tabs.sendMessage(tabs[0].id, { 'message': 'fromPopupToContentScript:gluttonList' });
  });
}

function setInfos(item) {
  let container = $('#glutton-list-selected-item-data'),
    keys = Object.keys(item);
  container.empty();
  for (var i = 0; i < keys.length; i++) {
    if (typeof item[keys[i]] !== 'undefined') {
      let row = $('<div>').addClass('data-row'),
        key = $('<div>')
          .addClass('key')
          .text(keys[i]),
        value;
      if (isLink(keys[i])) value = createLink(item[keys[i]]);
      else
        value = $('<div>')
          .addClass('value')
          .text(item[keys[i]]);

      row.append(key).append(value);
      container.append(row);
    }
  }
}

function buildGrobidBtn(state) {
  if (state) $('#grobid').css('display', 'block');
  else $('#grobid').css('display', 'none');
}

function buildGluttonList(items) {
  $('#popup-body #glutton-list-selected-item').css('display', 'none');
  $('#popup-body #glutton-list-data').empty();
  if (items.length === 0) {
    $('#popup-body #glutton-list-no-data').css('display', 'block');
    $('#popup-body #glutton-list-data').css('display', 'none');
  } else {
    $('#popup-body #glutton-list-no-data').css('display', 'none');
    $('#popup-body #glutton-list-data').css('display', 'block');
    let list = $('<ul>');
    for (var i = 0; i < items.length; i++) {
      list.append(createItem(items[i], list));
    }
    $('#popup-body #glutton-list-data').append(list);
  }
}

function isLink(key) {
  return key === 'istexLink' || key === 'oaLink' || key === 'URL';
}

function createLink(href) {
  return $('<a>')
    .attr('href', href)
    .text(href)
    .addClass('value');
}

function createItem(item, list) {
  let searchBtn = $('<i>').addClass('fas fa-search'),
    data = $('<div>').text(item.id + ' - ' + item.text),
    result = $('<li>')
      .attr('gluttonId', item.id)
      .append(data)
      .append(searchBtn);
  searchBtn.click(function() {
    chrome.tabs.query(openTabQuery, function(tabs) {
      chrome.tabs.sendMessage(tabs[0].id, {
        'message': 'fromPopupToContentScript:selectRefbib',
        'data': { 'gluttonId': result.attr('gluttonId') }
      });
    });
  });
  data.click(function() {
    if (!result.hasClass('selected')) {
      let list = $('#glutton-list-data');
      $('#glutton-list-data .selected').removeClass('selected');
      result.addClass('selected', true);
      list.animate(
        {
          scrollTop: list.scrollTop() + (result.offset().top - list.offset().top) - (result.height() * 1.5 + 3)
        },
        500
      );
      setInfos(item.data);
      $('#cite-bibtex').attr('gluttonid', item.id);
      $('#glutton-list-selected-item').css('display', 'block');
    } else {
      $('#glutton-list-data .selected').removeClass('selected');
      $('#glutton-list-selected-item').css('display', 'none');
    }
  });
  return result;
}
