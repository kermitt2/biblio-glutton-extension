/*
 * @prettier
 */
'use strict';

if (typeof browser !== 'undefined')
  browser.storage.local.get().then(function(settings) {
    GluttonLinkInserter.config(settings);
    setTimeout(GluttonLinkInserter.onDOMContentLoaded, 0);
    return doTheJob(settings);
  });
else
  chrome.storage.local.get(null, function(settings) {
    if (chrome.runtime.lastError) console.log('error chrome.storage.local.get', chrome.runtime.lastError);
    GluttonLinkInserter.config(settings);
    setTimeout(GluttonLinkInserter.onDOMContentLoaded, 0);
    return doTheJob(settings);
  });

function doTheJob(settings) {
  console.log(window.document.contentType);

  var port = chrome.runtime.connect(),
    page = {
      'contentType': window.document.contentType
    };

  let processCitationUrl = settings.GROBID_URL + '/processCitation',
    processHeaderDocumentUrl = settings.GROBID_URL + '/processHeaderDocument',
    referenceAnnotationsUrl = settings.GROBID_URL + '/referenceAnnotations',
    lookupUrl = settings.GLUTTON_URL + '/lookup';

  port.postMessage(page);

  let refbibs = {},
    targets = {},
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
  chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    console.log(request);
    // Send selection to GROBID services
    if (request.message === 'fromContextMenusToContentScript:resolve') {
      let selection = window.getSelection(),
        target = getCommonParent(selection.focusNode, selection.anchorNode),
        gluttonId = GluttonLinkInserter.newGluttonLinkId();
      if (typeof refbibs[gluttonId] === 'undefined') refbibs[gluttonId] = {};
      Object.assign(refbibs[gluttonId], { 'text': selection.toString() });
      targets[gluttonId] = target;
      return chrome.runtime.sendMessage({
        'message': 'fromContentScriptToBackground:resolve',
        'data': {
          'processCitationUrl': processCitationUrl,
          'lookupUrl': lookupUrl,
          'method': 'POST',
          'data': {
            'citations': selection.toString()
          },
          'dataType': 'xml',
          'gluttonId': gluttonId
        }
      });
      // Get result from background (GROBID processHeaderDocument result)
    } else if (request.message === 'fromBackgroundToContentScript:processHeaderDocument') {
      // Get result from background (GROBID referenceAnnotations result)
    } else if (request.message === 'fromBackgroundToContentScript:referenceAnnotations') {
      // Get result from background (GROBID processCitation result)
    } else if (request.message === 'fromBackgroundToContentScript:resolve') {
      if (!request.data.err) {
        Object.assign(refbibs[request.data.res.gluttonId], request.data.res);
        return addGluttonButtons(
          targets[request.data.res.gluttonId],
          createGluttonButtons(
            request.data.res.oaLink,
            createIstexLink(request.data.res.istexId),
            request.data.res.gluttonId
          )
        );
      } else alert(request.data.res);
      // Cite
    } else if (request.message === 'fromContextMenusToContentScript:cite') {
      if (gluttonLinkClicked !== null) {
        let id = gluttonLinkClicked.parent('span').attr('gluttonId');
        if (typeof refbibs[id] === 'undefined' || typeof refbibs[id].publisher === 'undefined') {
          return chrome.runtime.sendMessage({
            'message': 'fromContentScriptToBackground:resolve',
            'data': {
              'processCitationUrl': processCitationUrl,
              'lookupUrl': lookupUrl,
              'method': 'POST',
              'data': {
                'citations': gluttonLinkClicked
                  .parent('span')
                  .prev()
                  .text()
              },
              'dataType': 'xml',
              'id': id
            }
          });
        } else return copyClipboard(createBibtex(id));
      } else alert('Cite are only works on glutton links');
      // Build Cite
    } else if (request.message === 'fromContextMenuToContentScript:cite') {
      return copyClipboard(createBibtex(id));
      // Select refbib & highlight it
    } else if (request.message === 'fromPopupToContentScript:selectRefbib') {
      return selectRefbib(request.data.gluttonId);
      // Add refbib into refbibs
    } else if (request.message === 'fromBackgroundToContentScript:addRefbib') {
      refbibs[request.data.gluttonId] = request.data;
      return;
      // Build refbibs list & send it to popup
    } else if (request.message === 'fromPopupToContentScript:gluttonList') {
      let result = [];
      for (let [key, refbib] of Object.entries(refbibs)) {
        if (refbib !== null)
          result.push({
            'id': refbib.gluttonId,
            'data': refbib,
            'text': getRefbibId(refbib)
          });
      }
      return chrome.runtime.sendMessage({ 'message': 'fromContentScriptToPopup:gluttonList', 'data': result });
      // Add refbib into refbibs
    } else if (request.message === 'fromPopupToContentScript:grobidBtn') {
      return chrome.runtime.sendMessage({
        'message': 'fromContentScriptToPopup:grobidBtn',
        'data': page.contentType === 'application/pdf'
      });
    } else if (request.message === 'fromPopupToContentScript:referenceAnnotations') {
      return chrome.runtime.sendMessage({
        'message': 'fromContentScriptToBackground:referenceAnnotations',
        'data': {
          'processHeaderDocumentUrl': processHeaderDocumentUrl,
          'referenceAnnotationsUrl': referenceAnnotationsUrl,
          'lookupUrl': lookupUrl,
          'gluttonId': GluttonLinkInserter.newGluttonLinkId(),
          'method': 'POST',
          'input': window.location.href,
          'dataType': 'json'
        }
      });
    }
  });

  // Return value of show-istex settings
  function showIstex() {
    return typeof settings.SHOW_ISTEX !== 'undefined' && settings.SHOW_ISTEX;
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
      .stop(true, true)
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
    if (!id) return;
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

  // Get common parents of two elements
  function getCommonParent(a, b) {
    return $(a)
      .parents()
      .has($(b))
      .first();
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
}
