/*
 * @prettier
 */

let openTabQuery = { 'active': true, 'currentWindow': true };

window.onload = function() {
  browser.tabs.query(openTabQuery, function(tabs) {
    $('#debug').text('#' + tabs[0].id + ' - ' + new Date().toLocaleString());
    $('#glutton-list-selected-item').hide();
  });
  refreshGluttonList();
};

browser.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.message === 'gluttonList') return addGluttonList(request.data);
});

function onOpened() {
  console.log(`Options page opened`);
}

function onError(error) {
  console.log(`Error: ${error}`);
}

$('#preferences').click(function() {
  let opening = browser.runtime.openOptionsPage();
  opening.then(onOpened, onError);
});

function defaultCallback(res) {
  alert(res);
}

function refreshGluttonList() {
  $('#glutton-list-data').empty();
  browser.tabs.query(openTabQuery, function(tabs) {
    browser.tabs.sendMessage(tabs[0].id, { 'message': 'gluttonList' });
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

function addGluttonList(items) {
  let list = $('<ul>');
  for (var i = 0; i < items.length; i++) {
    list.append(createItem(items[i], list));
  }
  $('#glutton-list-data').append(list);
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
    data.click();
    browser.tabs.query(openTabQuery, function(tabs) {
      browser.tabs.sendMessage(tabs[0].id, {
        'message': 'selectRefbib',
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
      $('#glutton-list-selected-item').show();
    } else {
      $('#glutton-list-data .selected').removeClass('selected');
      $('#glutton-list-selected-item').hide();
    }
  });
  return result;
}
