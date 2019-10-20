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

  let refbibs = {};

  browser.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.message === 'searchRefbib') {
      return searchRefbib(request.data.selectionText);
    }
    if (request.message === 'selectRefbib') {
      return selectRefbib(request.data.gluttonId);
    }
    if (request.message === 'addRefbib') {
      refbibs[request.data.gluttonId] = request.data;
    }
    if (request.message === 'gluttonList') {
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

  function showIstex() {
    return typeof settings['show-istex'] !== 'undefined' && settings['show-istex'];
  }

  function copyClipboard(text) {
    const el = document.createElement('textarea'); // Create a <textarea> element
    el.value = text; // Set its value to the string that you want copied
    el.setAttribute('readonly', ''); // Make it readonly to be tamper-proof
    el.style.position = 'absolute';
    el.style.left = '-9999px'; // Move outside the screen to make it invisible
    document.body.appendChild(el); // Append the <textarea> element to the HTML document
    const selected =
      document.getSelection().rangeCount > 0 // Check if there is any content selected previously
        ? document.getSelection().getRangeAt(0) // Store selection if found
        : false; // Mark as false to know no selection existed before
    el.select(); // Select the <textarea> content
    document.execCommand('copy'); // Copy - only works as a result of a user action (e.g. click events)
    document.body.removeChild(el); // Remove the <textarea> element
    if (selected) {
      // If a selection existed before copying
      document.getSelection().removeAllRanges(); // Unselect everything on the HTML document
      document.getSelection().addRange(selected); // Restore the original selection
    }
    return alert('Text copied in the clipboard');
  }

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

  function getRefbibId(refbib) {
    let keys = ['doi', 'pmid', 'pmc', 'istexid'];
    for (let i = 0; i < keys.length; i++) {
      if (typeof refbib[keys[i]] !== 'undefined') return refbib[keys[i]];
    }
    return getRefbibText(refbib.gluttonId);
  }

  function getRefbibText(id) {
    let span = $('span[gluttonId="' + id + '"]'),
      previous = span.prev();
    if (previous.length === 0) previous = span.parent().prev();
    return previous.text();
  }

  function createGluttonButtons(oaLink = '', istexLink = '', id = 'null') {
    let result = document.createElement('span');
    result.setAttribute('gluttonId', id);
    result.appendChild(createLink(oaLink, oaLink !== '' ? 'glutton-link' : 'glutton-link-disabled', 'glutton'));
    if (istexLink !== '' && showIstex()) result.appendChild(createLink(istexLink, 'glutton-link', 'istex'));
    if (typeof refbibs[id].publisher !== 'undefined') result.appendChild(createCiteBtn(id));
    result.appendChild(createId(id));
    return result;
  }

  function addGluttonButtons(target, elements) {
    let alreadyExist = target.find('span[gluttonid]');
    if (alreadyExist.length > 0) {
      alreadyExist.each(function() {
        let id = $(this).attr('gluttonid');
        refbibs[id] = null;
      });
      alreadyExist.replaceWith(elements);
    } else target.append(elements);
  }

  function createCiteBtn(id) {
    let a = document.createElement('a');
    a.href = '';
    a.target = '_blank';
    a.alt = 'Glutton';
    a.name = 'GluttonLink';
    a.className = 'glutton-cite';
    a.textContent = 'cite';
    a.rel = 'noopener noreferrer';
    a.setAttribute('gluttonid', id);
    $(a).click(function(event) {
      event.preventDefault();
      let id = $(this).attr('gluttonid');
      return copyClipboard(createBibtex(id));
    });
    return a;
  }

  function createId(text) {
    let result = document.createElement('sup');
    result.className = 'glutton-indice';
    result.textContent = text;
    return result;
  }

  function createIstexLink(id) {
    return 'https://api.istex.fr/document/' + id + '/fulltext/pdf';
  }

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

  function getCommonParent(a, b) {
    return $(a)
      .parents()
      .has($(b))
      .first();
  }

  function searchRefbib(text) {
    let selection = window.getSelection(),
      target = getCommonParent(selection.focusNode, selection.anchorNode),
      hasGluttonBtn = target.has('span > a[name="test"]');
    if (hasGluttonBtn.length === 0) {
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
              console.log(data);
              let gluttonId = Object.keys(refbibs).length.toString();
              data.gluttonId = gluttonId;
              refbibs[gluttonId] = data;
              return addGluttonButtons(
                target,
                createGluttonButtons(data.oaLink, createIstexLink(data.istexId), gluttonId)
              );
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
  }

  function createBibtex(id) {
    console.log(id, refbibs[id]);
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
