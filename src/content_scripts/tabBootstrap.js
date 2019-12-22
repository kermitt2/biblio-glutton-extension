/*
 * @prettier
 */
'use strict';

chrome.storage.local.get(null, function(settings) {
  if (chrome.runtime.lastError) console.log('error chrome.storage.local.get', chrome.runtime.lastError);
  console.log(settings);
  GluttonLinkInserter.config(settings);
  setTimeout(GluttonLinkInserter.onDOMContentLoaded, 0);
  ModalManager.init(settings);
  return doTheJob(settings);
});

function doTheJob(settings) {
  console.log(window.document.contentType);

  // Set undefined to ignore right clic on non Glutton link
  $('a:not([name="GluttonLink"]').contextmenu(function() {
    GluttonLinkInserter.refbibs.current = undefined;
  });
  $(document).bind('DOMNodeInserted', function(e) {
    var element = $(e.target);
    if (element.is('a') && element.attr('name') !== 'GluttonLink')
      return element.contextmenu(function() {
        GluttonLinkInserter.refbibs.current = undefined;
      });
  });

  ModalManager.insertModal();

  // Click on processPdf button
  ModalManager.processPdf(function() {
    if (
      typeof GluttonLinkInserter.refbibs.current.services.processPdf === 'undefined' &&
      typeof GluttonLinkInserter.refbibs.current.pdf === 'undefined'
    )
      return chrome.runtime.sendMessage({
        'message': 'fromContentScriptToBackground:processPdf',
        'data': {
          'services': {
            'processHeaderDocument': {
              'url': URLS.processHeaderDocument
            },
            'referenceAnnotations': {
              'url': URLS.referenceAnnotations
            }
          },
          'gluttonId': GluttonLinkInserter.refbibs.current.gluttonId,
          'input': GluttonLinkInserter.refbibs.current.oaLink
        }
      });
    else ModalManager.update(getDataForModal());
  });

  // Click on openUrl button
  ModalManager.openUrl(function() {
    return chrome.runtime.sendMessage({
      'message': 'fromContentScriptToBackground:openTab',
      'data': { 'url': ModalManager.getLink(GluttonLinkInserter.refbibs.current) }
    });
  });

  // Click on cite button
  ModalManager.processCite(function() {
    let citeType = ModalManager.getCiteType();
    return ModalManager.buildCite(citeType, GluttonLinkInserter.refbibs.current);
  });

  // Click on copy button
  ModalManager.processCopy(function() {
    return ModalManager.copyClipboard();
  });

  var port = chrome.runtime.connect(),
    page = {
      'contentType': window.document.contentType
    };

  const URLS = {
    'processCitation': settings.GROBID_URL + '/processCitation',
    'processHeaderDocument': settings.GROBID_URL + '/processHeaderDocument',
    'referenceAnnotations': settings.GROBID_URL + '/referenceAnnotations',
    'lookup': settings.GLUTTON_URL + '/lookup',
    'oa/oa_istex': settings.GLUTTON_URL + (settings.SHOW_ISTEX ? '/oa_istex' : '/oa')
  };

  port.postMessage(page);

  // Listeners
  chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    console.log(request);
    // Send selection to GROBID services
    if (request.message === 'fromContextMenusToContentScript:parseReference') {
      let selection = window.getSelection(),
        parent = getCommonParent(selection.focusNode, selection.anchorNode),
        target = parent.get(0),
        hasGluttonId = parent.siblings('span[gluttonId]'),
        refbib;
      if (hasGluttonId.length > 0) {
        refbib = GluttonLinkInserter.refbibs.get(hasGluttonId.attr('gluttonId'));
        hasGluttonId.remove();
      } else refbib = GluttonLinkInserter.refbibs.new();
      GluttonLinkInserter.refbibs.update(refbib.gluttonId, { 'target': target });
      return chrome.runtime.sendMessage({
        'message': 'fromContentScriptToBackground:parseReference',
        'data': {
          'services': {
            'processCitation': {
              'url': URLS.processCitation,
              'data': {
                'citations': selection.toString()
              }
            },
            'lookup': {
              'url': URLS.lookup,
              'defaultParams': getLookupDefaultParams(refbib)
            }
          },
          'gluttonId': refbib.gluttonId
        }
      });
      // Get result from background (GROBID processCitation result)
    } else if (request.message === 'fromBackgroundToContentScript:parseReference') {
      if (request.data.err) {
        if (request.data.res.error.status === 400) alert('Error : There is no data available');
        else alert(errorMsg(request.data.res.error));
        GluttonLinkInserter.refbibs.stats.fail++;
      } else GluttonLinkInserter.refbibs.stats.success++;
      GluttonLinkInserter.refbibs.stats.count++;
      let refbib = GluttonLinkInserter.refbibs.update(request.data.res.refbib.gluttonId, request.data.res.refbib);
      if (refbib.target) GluttonLinkInserter.createGluttonLinks(refbib, settings.SHOW_ISTEX);
      if (
        typeof GluttonLinkInserter.refbibs.current !== 'undefined' &&
        refbib.gluttonId === GluttonLinkInserter.refbibs.current.gluttonId
      ) {
        GluttonLinkInserter.refbibs.current = GluttonLinkInserter.refbibs.getData(refbib.gluttonId);
        ModalManager.update(getDataForModal());
        return refreshDataIntoPopup();
      }
      // Get result from background (GROBID referenceAnnotations result)
    } else if (request.message === 'fromBackgroundToContentScript:processPdf') {
      if (request.data.err) alert('Error : WebExtension did not find direct link of PDF file');
      // if (request.data.err) alert(errorMsg(request.data.res.error));
      GluttonLinkInserter.refbibs.update(request.data.res.refbib.gluttonId, request.data.res.refbib);
      GluttonLinkInserter.refbibs.current = GluttonLinkInserter.refbibs.getData(request.data.res.refbib.gluttonId);
      ModalManager.update(getDataForModal());
      // Get result from background (lookup & oa/oa_istex result)
    } else if (
      request.message === 'fromBackgroundToContentScript:lookup' ||
      request.message === 'fromBackgroundToContentScript:oa/oa_istex'
    ) {
      if (request.data.err) GluttonLinkInserter.refbibs.stats.fail++;
      else GluttonLinkInserter.refbibs.stats.success++;
      GluttonLinkInserter.refbibs.stats.count++;
      let service = request.message.split(':')[1],
        refbib = GluttonLinkInserter.refbibs(request.data.res.refbib.gluttonId);
      GluttonLinkInserter.refbibs.update(refbib.gluttonId, request.data.res.refbib);
      // Cite
    } else if (request.message === 'fromContextMenusToContentScript:cite') {
      if (typeof GluttonLinkInserter.refbibs.current === 'undefined')
        return alert('Cite only available on glutton links');
      if (
        typeof GluttonLinkInserter.refbibs.current.publisher === 'undefined' &&
        typeof GluttonLinkInserter.refbibs.current.services.processCitation === 'undefined'
      ) {
        let refbib = GluttonLinkInserter.refbibs.get(GluttonLinkInserter.refbibs.current.gluttonId);
        chrome.runtime.sendMessage({
          'message': 'fromContentScriptToBackground:parseReference',
          'data': {
            'services': {
              'processCitation': {
                'url': URLS.processCitation,
                'data': {
                  'citations': $(refbib.buttons)
                    .prev()
                    .text()
                }
              },
              'lookup': {
                'url': URLS.lookup,
                'defaultParams': getLookupDefaultParams(refbib)
              }
            },
            'gluttonId': refbib.gluttonId
          }
        });
      }
      ModalManager.update(getDataForModal());
      return ModalManager.show();
      // refresh Glutton UI
    } else if (request.message === 'fromPopupToContentScript:refreshGluttonUI') {
      return refreshDataIntoPopup();
      // Select refbib & highlight it
    } else if (request.message === 'fromPopupToContentScript:ping') {
      return chrome.runtime.sendMessage({ 'message': 'fromContentScriptToPopup:pong' });
      // Select refbib & highlight it
    } else if (request.message === 'fromPopupToContentScript:highlight') {
      let refbib = GluttonLinkInserter.refbibs(request.data.gluttonId);
      return highlight(refbib.buttons);
    }
  });

  function errorMsg(error) {
    return [
      error.textStatus,
      ' ',
      error.status,
      ' : ',
      error.errorThrown !== '' ? error.errorThrown : 'Service not responding'
    ].join('');
  }

  // get Lookup default params of a refbib
  function getLookupDefaultParams(refbib) {
    if (typeof refbib.services === 'undefined') return {};
    return typeof refbib.services['oa/oa_istex'] !== 'undefined'
      ? refbib.services['oa/oa_istex'].parameters
      : typeof refbib.services.lookup !== 'undefined'
      ? refbib.services.lookup.parameters
      : {};
  }

  // refresh current refbib in Popup
  function refreshDataIntoPopup() {
    return chrome.runtime.sendMessage({
      'message': 'fromContentScriptToPopup:refreshGluttonUI',
      'data': {
        'stats': GluttonLinkInserter.refbibs.stats,
        'refbibs': { 'count': GluttonLinkInserter.refbibs.count() }
      }
    });
  }

  function getDataForModal() {
    return {
      'refbib': GluttonLinkInserter.refbibs.current
    };
  }

  // Higlight element
  function highlight(element) {
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
    return getRefbibText(refbib);
  }

  // Get text of refbib
  function getRefbibText(refbib) {
    let span = refbib.parent,
      previous = span.prev();
    if (previous.length === 0) previous = span.parent().prev();
    return previous.text();
  }

  // Get common parents of two elements
  function getCommonParent(a, b) {
    return $(a)
      .parents()
      .has($(b))
      .first();
  }
}
