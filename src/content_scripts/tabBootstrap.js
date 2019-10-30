/*
 * @prettier
 */
'use strict';

browser.storage.local.get().then(function(settings) {
  var port = browser.runtime.connect(),
    page = {
      'contentType': window.document.contentType
    };

  let refbibUrl = 'http://localhost:8070/api/processCitation',
    gluttonLookupUrl = 'http://cloud.science-miner.com/glutton/service/lookup',
    gluttonOAUrl = 'http://cloud.science-miner.com/glutton/service/oa_istex';

  port.postMessage(page);

  let refbibs = {},
    gluttonLinkClicked = null;

  // Handle context menu 'cite'
  $(document).ready(function() {
    $('a').contextmenu(function() {
      gluttonLinkClicked = $(this).attr('name') === 'GluttonLink' ? $(this) : null;
    });
    $(document).bind('DOMNodeInserted', function(e) {
      var element = $(e.target);
      if (element.is('a'))
        return element.contextmenu(function() {
          gluttonLinkClicked = $(this).attr('name') === 'GluttonLink' ? $(this) : null;
        });
      return element.find('a').contextmenu(function() {
        gluttonLinkClicked = $(this).attr('name') === 'GluttonLink' ? $(this) : null;
      });
    });
  });

  // Listeners
  browser.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    // Send selection to GROBID services
    if (request.message === 'resolve') {
      let selection = window.getSelection(),
        target = getCommonParent(selection.focusNode, selection.anchorNode),
        hasGluttonBtn = target.has('span > a[name="test"]');
      if (hasGluttonBtn.length === 0) {
        return resolve(request.data.selectionText, null, function(data) {
          addGluttonButtons(target, createGluttonButtons(data.oaLink, createIstexLink(data.istexId), data.gluttonId));
        });
      }
      // Cite
    } else if (request.message === 'cite') {
      if (gluttonLinkClicked !== null) {
        let id = gluttonLinkClicked.parent('span').attr('gluttonId');
        if (typeof refbibs[id] === 'undefined' || typeof refbibs[id].publisher === 'undefined') {
          return resolve(
            gluttonLinkClicked
              .parent('span')
              .prev()
              .text(),
            id,
            function(data) {
              return copyClipboard(createBibtex(id));
            }
          );
        } else return copyClipboard(createBibtex(id));
      } else alert('Cite are only works on glutton links');
      // Select refbib & highlight it
    } else if (request.message === 'selectRefbib') {
      return selectRefbib(request.data.gluttonId);
      // Add refbib into refbibs
    } else if (request.message === 'addRefbib') {
      refbibs[request.data.gluttonId] = request.data;
      // Build refbibs list & send it to popup
    } else if (request.message === 'gluttonList') {
      let result = [];
      for (let [key, refbib] of Object.entries(refbibs)) {
        if (refbib !== null)
          result.push({
            'id': refbib.gluttonId,
            'data': refbib,
            'text': refbib.text ? refbib.text : getRefbibId(refbib)
          });
      }
      return browser.runtime.sendMessage({ 'message': 'gluttonList', 'data': result });
    }
  });

  // Return value of show-istex settings
  function showIstex() {
    return typeof settings['show-istex'] !== 'undefined' && settings['show-istex'];
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

  // Higlight the span with given id
  function selectRefbib(id) {
    let element = $('span[gluttonId="' + id + '"]');
    $([document.documentElement, document.body]).animate(
      {
        scrollTop: element.offset().top - $(window).height() / 2
      },
      500
    );
    element
      .addClass('glutton-selected')
      .fadeOut(500)
      .fadeIn(500)
      .fadeOut(500)
      .fadeIn(500)
      .fadeOut(500)
      .fadeIn(500)
      .removeClass('glutton-selected');
  }

  // Get an id of given refbib, (or text of it if there is no id)
  function getRefbibId(refbib) {
    let keys = ['doi', 'pmid', 'pmc', 'istexid'];
    for (let i = 0; i < keys.length; i++) {
      if (typeof refbib[keys[i]] !== 'undefined') return refbib[keys[i]];
    }
    return getRefbibText(refbib.gluttonId);
  }

  // Get text of refbib with given id
  function getRefbibText(id) {
    let span = $('span[gluttonId="' + id + '"]'),
      previous = span.prev();
    if (previous.length === 0) previous = span.parent().prev();
    return previous.text();
  }

  // Create group of Glutton buttons
  function createGluttonButtons(oaLink = '', istexLink = '', id = 'null') {
    let result = document.createElement('span');
    result.setAttribute('gluttonId', id);
    result.appendChild(createLink(oaLink, oaLink !== '' ? 'glutton-link' : 'glutton-link-disabled', 'glutton'));
    if (istexLink !== '' && showIstex()) result.appendChild(createLink(istexLink, 'glutton-link', 'istex'));
    result.appendChild(createId(id));
    return result;
  }

  // Add (or refresh) glutton button
  function addGluttonButtons(target, elements) {
    let alreadyExist = target.find('span[gluttonid]');
    œœ;
    if (alreadyExist.length > 0) {
      alreadyExist.each(function() {
        let id = $(this).attr('gluttonid');
        refbibs[id] = null;
      });
      alreadyExist.replaceWith(elements);
    } else target.append(elements);
  }

  // Create element to display 'id' of Glutton buttons
  function createId(text) {
    let result = document.createElement('sup');
    result.className = 'glutton-indice';
    result.textContent = text;
    return result;
  }

  // Create an ISTEX link
  function createIstexLink(id) {
    return 'https://api.istex.fr/document/' + id + '/fulltext/pdf';
  }

  // Create a Glutton link element
  function createLink(resourceUrl = '', className = '', text = 'null') {
    // set the added link, this will avoid an extra call to the OpenURL API and fix the access url
    let a = document.createElement('a');
    a.href = resourceUrl;
    a.target = '_blank';
    a.alt = 'Glutton';
    a.name = 'GluttonLink';
    a.className = className;
    a.textContent = text;
    a.rel = 'noopener noreferrer';
    if (resourceUrl === '')
      $(a).click(function(event) {
        event.preventDefault();
      });
    return a;
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

  // Get common parents of two elements
  function getCommonParent(a, b) {
    return $(a)
      .parents()
      .has($(b))
      .first();
  }

  // Call GROBID service to resolve refbib
  function resolve(text, id = null, cb) {
    return $.ajax({
      'url': refbibUrl,
      'method': 'POST',
      'data': {
        'citations': text
      },
      'dataType': 'xml'
    })
      .done(function(data) {
        let parameters = extractParams(data.documentElement),
          url = buildUrl(gluttonLookupUrl, parameters);
        return $.get(url)
          .done(function(data) {
            let gluttonId = id === null ? Object.keys(refbibs).length.toString() : id;
            data.gluttonId = gluttonId;
            refbibs[gluttonId] = data;
            return cb(data);
          })
          .fail(function(res) {
            console.log(res);
            alert('SearchRefBib failed : ' + res.responseJSON.message);
          });
      })
      .fail(function(res) {
        console.log(res);
        alert(res.statusText);
      });
  }

  // Build cite with Bibtex format
  function createBibtex(id) {
    if (typeof refbibs[id] === 'undefined' || typeof refbibs[id].publisher === 'undefined') return null;
    let author =
      typeof refbibs[id].author !== 'undefined' && refbibs[id].author.length > 0
        ? refbibs[id].author[0].family + ',' + refbibs[id].author[0].given
        : '';
    let booktitle = refbibs[id].title || '';
    let month =
      typeof refbibs[id].issued !== 'undefined' && typeof refbibs[id].issued['date-parts'] !== 'undefined'
        ? refbibs[id].issued['date-parts'][0][1]
        : '';
    let pages = refbibs[id].page || '';
    let publisher = refbibs[id].publisher || '';
    let title = typeof refbibs[id].title !== 'undefined' ? refbibs[id].title[0] : '';
    let type = refbibs[id].type || '';
    let url = typeof refbibs[id].link !== 'undefined' && refbibs[id].link.length > 0 ? refbibs[id].link[0].URL : '';
    let volume = refbibs[id].volume || '';
    let year =
      typeof refbibs[id].issued !== 'undefined' &&
      refbibs[id].issued['date-parts'] &&
      refbibs[id].issued['date-parts'].length > 0
        ? refbibs[id].issued['date-parts'][0][0]
        : '';
    let result =
      '@book{' +
      // 'address="",\n' +
      // 'abstract="",\n' +
      // 'annote="",\n' +
      'author="' +
      author +
      '",\n' +
      'booktitle="' +
      booktitle +
      '",\n' +
      // 'chapter="",\n' +
      // 'crossref="",\n' +
      // 'edition="",\n' +
      // 'editor="",\n' +
      // 'eprint="",\n' +
      // 'howpublished="",\n' +
      // 'institution="",\n' +
      // 'journal="",\n' +
      // 'key="",\n' +
      'month="' +
      month +
      '"\n' +
      // 'note="",\n' +
      // 'number="",\n' +
      // 'organization="",\n' +
      'pages="' +
      pages +
      '",\n' +
      'publisher="' +
      publisher +
      '",\n' +
      // 'school="",\n' +
      // 'series="",\n' +
      'title="' +
      title +
      '",\n' +
      'type="' +
      type +
      '",\n' +
      'url="' +
      url +
      '",\n' +
      'volume="' +
      volume +
      '",\n' +
      'year="' +
      year +
      '"\n' +
      '}';
    return result;
  }
});

function onUpdated() {
  console.log('item updated successfully');
}

function onError() {
  console.log('error updating item:' + browser.runtime.lastError);
}
