/*
 * @prettier
 */
'use strict';

const getWebExtensionURL = function(url) {
  return typeof browser !== 'undefined' ? browser.runtime.getURL(url) : chrome.runtime.getURL(url);
};

let workerSrcPath = getWebExtensionURL('vendors/pdf.js/build/generic/build/pdf.worker.js');

if (
  typeof pdfjsLib === 'undefined' ||
  (!pdfjsLib && (!pdfjsLib.getDocument || !pdfjsViewer.PDFViewer || !pdfjsViewer.PDFLinkService))
) {
  console.error('Please build the pdfjs-dist library using\n' + '  `gulp dist-install`');
}
// The workerSrc property shall be specified.
//
else pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrcPath;

// Some PDFs need external cmaps.
//
const CMAP_URL = getWebExtensionURL('vendors/pdf.js/build/generic/web/cmaps/'),
  CMAP_PACKED = true;

const modalContent =
    `<div class="modal-dialog" role="document">
    <div class="modal-content">
      <div class="modal-header">
        <div class="modal-title" id="gluttonModalLabel">Glutton Extension</div>
        <div id="modal-buttons">
          <div id="openUrl">
            <button class="btn btn-sm btn-light btn-outline-secondary" type="button">
              <i class="fas fa-external-link-alt"></i>
            </button>
          </div>
          <div id="processPdf">
            <button class="btn btn-sm btn-light btn-outline-secondary" type="button">
              <i class="fas fa-file-upload"></i>
            </button>
          </div>
          <div>
            <button type="button" class="close" data-dismiss="modal" aria-label="Close">
              <span aria-hidden="true">&times;</span>
            </button>
          </div>
        </div>
      </div>
      <div class="modal-body">` +
    `
  <div id="modal-refbib">
    <div class="data-row">
      <div class='modal-subtitle'>About this Reference :</div>
    </div>
    <div class="data-row">
      <div id="refbib"></div>
    </div>
  </div>
  <div id="modal-cite">
    <div class="data-row">
      <div class='modal-subtitle'>Cite :</div>
    </div>
    <div class="data-row">
      <div id="citeType">
        <input type="radio" name="citeType" id="bibtex" value="bibtex" checked>
        <label for="bibtex">Bibtex</label>
        <input type="radio" name="citeType" id="ohter" value="ohter">
        <label for="ohter">Other</label>
      </div>
      <div id="processCite">
        <button class="btn btn-sm btn-light btn-outline-secondary" type="button">
          <i class="fas fa-quote-right"></i>
        </button>
      </div>
      <div id="processCopy">
        <button class="btn btn-sm btn-light btn-outline-secondary" type="button">
          <i class="fas fa-copy"></i>
        </button>
      </div>
    </div>
    <div class="data-row">
      <div id="citeString">
        <textearea></textarea>
      </div>
    </div>
  </div>
  <div id="modal-pdf">
    <div class="data-row">
      <div class='modal-subtitle'>Improved PDF view :</div>
    </div>
    <div class="data-row">
      <div id="gluttonPdf">
        <div id="viewerContainer">
          <div id="viewer" class="pdfViewer"></div>
        </div>
      </div>
    </div>
  </div>` +
    `</div>
      <div class="modal-footer">
        <button type="button" class="btn btn-secondary" data-dismiss="modal">Close</button>
      </div>
    </div>
  </div>`,
  modalContainer =
    `<div class="modal fade" id="gluttonModal" tabindex="-1" role="dialog" aria-labelledby="gluttonModalLabel" aria-hidden="true">` +
    modalContent +
    `</div>`;

let ModalManager = {
  'dataView': {
    'keys': ['atitle', 'author', 'oaLink', 'istexLink'],
    'data': {
      'atitle': { 'label': 'Title', 'type': 'text' },
      'author': {
        'label': 'First Author',
        'type': 'text',
        'extractData': function(data) {
          if (data[0]) return [data[0].family, data[0].given].join(', ');
          else return 'No data available';
        }
      },
      'istexLink': { 'label': 'ISTEX', 'type': 'href' },
      'oaLink': { 'label': 'Open Access', 'type': 'href' },
      'gluttonId': { 'label': 'GluttonId', 'type': 'text' }
    }
  },
  // Refresh openUrl button state
  'refreshOpenUrl': function(state) {
    if (typeof state !== 'undefined') return $('#openUrl > button').attr('disabled', !state);
  },

  // Refresh processPdf button state
  'refreshProcessPdfButton': function(state) {
    if (typeof browser !== 'undefined') {
      // Not supported on FF
      $('#processPdf > button').attr('disabled', true);
      return $('#processPdf').hide();
    }
    if (typeof state !== 'undefined') return $('#processPdf > button').attr('disabled', !state);
  },

  // Refresh refbib cite div
  'refreshRefbibCite': function(state) {
    $('#citeString > textearea').text('');
    if (typeof state !== 'undefined' && state) {
      $('#modal-cite').show();
      $('#processCite').show();
    } else {
      $('#modal-cite').hide();
      $('#processCite').hide();
    }
    if (typeof state !== 'undefined') {
      $('#processCopy > button').attr('disabled', true);
      return $('#processCite > button').attr('disabled', !state);
    }
  },

  // Refresh refbib cite div
  'refreshRefbibPdf': function(data, annotations) {
    if (typeof data === 'undefined' || typeof browser !== 'undefined') {
      return $('#modal-pdf').css('display', 'none');
    }
    $('#modal-pdf').css('display', 'block');
    return $.ajax({
      'method': 'GET',
      'url': data,
      'xhrFields': {
        'responseType': 'blob'
      }
    }).done(function(blob) {
      return blob.arrayBuffer().then(function(buffer) {
        GluttonLinkInserter.disabled = true; // Disable GluttonLinkInserter
        let renderStats = { 'textlayerrendered': 0, 'pagerendered': 0, 'tryCount': 0, 'tryMax': 10 };
        const pdfContainer = $('#gluttonPdf #viewerContainer').get(0);
        // (Optionally) enable hyperlinks within PDF files.
        let pdfLinkService = new pdfjsViewer.PDFLinkService();
        let pdfViewer = new pdfjsViewer.PDFViewer({
          'container': pdfContainer,
          'linkService': pdfLinkService
        });
        pdfLinkService.setViewer(pdfViewer);
        // Loading document.
        let loadingTask = pdfjsLib.getDocument({
          'data': buffer,
          'cMapUrl': CMAP_URL,
          'cMapPacked': CMAP_PACKED
        });

        // Check if all pages/layers are rendered & then add annotations
        document.addEventListener('pagesloaded', function(e) {
          let intervalID = window.setInterval(function() {
            console.log(renderStats);
            if (renderStats.textlayerrendered === 0 && renderStats.pagerendered === 0) {
              console.log(annotations);
              clearInterval(intervalID);
              ModalManager.setupAnnotations(annotations);
              GluttonLinkInserter.disabled = false; // Disable GluttonLinkInserter
            }
            renderStats.tryCount++;
            if (renderStats.tryCount > renderStats.tryMax) clearInterval(intervalID);
          }, 1000);
        });

        document.addEventListener('textlayerrendered', function(e) {
          renderStats.textlayerrendered -= 1;
        });
        document.addEventListener('pagerendered', function(e) {
          renderStats.pagerendered -= 1;
        });

        loadingTask.promise.then(function(pdfDocument) {
          renderStats.textlayerrendered = pdfDocument.numPages;
          renderStats.pagerendered = pdfDocument.numPages;
          // Document loaded, specifying document for the viewer and
          // the (optional) linkService.
          pdfViewer.setDocument(pdfDocument);

          pdfLinkService.setDocument(pdfDocument, null);
        });
      });
    });
  },

  // Set refbib values into modal HTML
  'setRefbib': function(refbib) {
    let container = $('#refbib');
    container.empty();
    $('#modal-cite').show();
    for (let i = 0; i < ModalManager.dataView.keys.length; i++) {
      let key = ModalManager.dataView.keys[i];
      if (typeof refbib[key] !== 'undefined' && refbib[key] !== null)
        container.append(ModalManager.buildData(ModalManager.dataView.data[key], refbib[key]));
    }
    if (container.find('.data-row').length === 0) container.text('There is no data available');
  },

  // Build HTML representation of data
  'buildData': function(key, value) {
    let container = $('<div>').addClass('data-row'),
      keyDiv = ModalManager.buildElement('text', key.label, 'key'),
      valueDiv =
        typeof key.extractData !== 'undefined'
          ? ModalManager.buildElement(key.type, key.extractData(value), 'value')
          : ModalManager.buildElement(key.type, value, 'value');
    return container.append(keyDiv).append(valueDiv);
  },

  // build an element
  'buildElement': function(type, value, className) {
    if (type === 'text')
      return $('<div>')
        .addClass(className)
        .text(value);
    else if (type === 'href')
      return $('<a>')
        .addClass(className)
        .attr('href', value)
        .text(value);
  },

  // Build cite
  'buildCite': function(citeType, refbib) {
    let txt = CITE[citeType](refbib);
    $('#processCopy > button').attr('disabled', false);
    return $('#citeString > textearea').text(txt);
  },

  // Copy to to clipboard the given text
  'copyClipboard': function() {
    navigator.clipboard.writeText($('#citeString > textearea').text()).then(
      function() {
        alert('Text copied in the clipboard');
      },
      function() {
        alert('Copy in clipboard failed');
      }
    );
  },
  'getElement': function() {
    return $(modalContainer);
  },
  'getLink': function(refbib) {
    let link = refbib.oaLink;
    if (typeof link === 'undefined' || !link) link = refbib.istexLink;
    return link;
  },
  'show': function() {
    return $('#gluttonModal').modal('show');
  },
  'hide': function() {
    return $('#gluttonModal').modal('hide');
  },
  'update': function(data) {
    let checkData = typeof data === 'object' && data,
      checkRefbib = checkData && typeof data.refbib === 'object' && data.refbib,
      oaLink = checkData && checkRefbib ? ModalManager.getLink(data.refbib) : undefined,
      refbib = checkData && checkRefbib ? data.refbib : undefined,
      pdf =
        checkData &&
        checkRefbib &&
        typeof data.refbib.pdf !== 'undefined' &&
        typeof data.refbib.pdf.data !== 'undefined'
          ? data.refbib.pdf.data
          : undefined,
      annotations =
        checkData &&
        checkRefbib &&
        typeof data.refbib.services !== 'undefined' &&
        typeof data.refbib.services.referenceAnnotations !== 'undefined'
          ? data.refbib.services.referenceAnnotations.res
          : undefined;
    ModalManager.refreshOpenUrl(oaLink);
    ModalManager.refreshProcessPdfButton(typeof oaLink !== 'undefined');
    ModalManager.setRefbib(refbib);
    ModalManager.refreshRefbibCite(refbib && refbib.publisher);
    ModalManager.refreshRefbibPdf(pdf, annotations);
  },
  'openUrl': function(cb) {
    return $('#openUrl').click(cb);
  },
  'processPdf': function(cb) {
    return $('#processPdf').click(cb);
  },
  'processCite': function(cb) {
    return $('#processCite').click(cb);
  },
  'processCopy': function(cb) {
    return $('#processCopy').click(cb);
  },
  'getCiteType': function() {
    return $('#citeType > input:checked')
      .first()
      .attr('value');
  },
  'insertModal': function() {
    $('body').append(ModalManager.getElement());
  },
  'setupAnnotations': function(data) {
    // we must check/wait that the corresponding PDF page is rendered at this point
    let json = data,
      pageInfo = json.pages,
      page_height = 0.0,
      page_width = 0.0,
      refBibs = json.refBibs,
      mapRefBibs = {};

    // Add gluttonAnnotations Layer fir each page
    $('#gluttonPdf .page[data-page-number]').each(function(index) {
      let pageDiv = $(this),
        container = $('<div>');
      container.addClass('gluttonAnnotations');
      pageDiv.prepend(container.append($('<div>')));
    });

    if (refBibs) {
      for (let n in refBibs) {
        let annotation = refBibs[n],
          theId = annotation.id,
          theUrl = annotation.url,
          pos = annotation.pos;
        if (pos) mapRefBibs[theId] = annotation;
        //for (let m in pos) {
        pos.forEach(function(thePos, m) {
          //let thePos = pos[m];
          // get page information for the annotation
          let pageNumber = thePos.p;
          if (pageInfo[pageNumber - 1]) {
            page_height = pageInfo[pageNumber - 1].page_height;
            page_width = pageInfo[pageNumber - 1].page_width;
          }
          ModalManager.annotateBib(true, theId, thePos, theUrl, page_height, page_width, null);
        });
      }
    }

    // we need the above mapRefBibs structure to be created to perform the ref. markers analysis
    let refMarkers = json.refMarkers;
    if (refMarkers) {
      // for(let n in refMarkers) {
      refMarkers.forEach(function(annotation, n) {
        //let annotation = refMarkers[n];
        let theId = annotation.id;
        if (!theId) return;
        // we take the first and last positions
        let targetBib = mapRefBibs[theId];
        if (targetBib) {
          let theBibPos = {};
          let pos = targetBib.pos;
          //if (pos && (pos.length > 0)) {
          let theFirstPos = pos[0];
          let theLastPos = pos[pos.length - 1];
          theBibPos.p = theFirstPos.p;
          theBibPos.w = Math.max(theFirstPos.w, theLastPos.w);
          theBibPos.h =
            Math.max(Math.abs(theLastPos.y - theFirstPos.y), theFirstPos.h) + Math.max(theFirstPos.h, theLastPos.h);
          theBibPos.x = Math.min(theFirstPos.x, theLastPos.x);
          theBibPos.y = Math.min(theFirstPos.y, theLastPos.y);
          let pageNumber = theBibPos.p;
          if (pageInfo[pageNumber - 1]) {
            page_height = pageInfo[pageNumber - 1].page_height;
            page_width = pageInfo[pageNumber - 1].page_width;
          }
          ModalManager.annotateBib(false, theId, annotation, null, page_height, page_width, theBibPos);
          //}
        } else {
          let pageNumber = annotation.p;
          if (pageInfo[pageNumber - 1]) {
            page_height = pageInfo[pageNumber - 1].page_height;
            page_width = pageInfo[pageNumber - 1].page_width;
          }
          ModalManager.annotateBib(false, theId, annotation, null, page_height, page_width, null);
        }
      });
    }
  },
  'annotateBib': function(bib, theId, thePos, url, page_height, page_width, theBibPos) {
    let page = thePos.p,
      pageDiv = $('#gluttonPdf .page[data-page-number="' + page + '"] .canvasWrapper'),
      annotationsContainer = $('#gluttonPdf .page[data-page-number="' + page + '"] .gluttonAnnotations div'),
      canvasHeight = pageDiv.height(),
      canvasWidth = pageDiv.width(),
      scale_x = canvasHeight / page_height,
      scale_y = canvasWidth / page_width,
      x = thePos.x * scale_x,
      y = thePos.y * scale_y,
      width = thePos.w * scale_x,
      height = thePos.h * scale_y;

    //console.log('annotate: ' + page + " " + x + " " + y + " " + width + " " + height);
    //console.log('location: ' + canvasHeight + " " + canvasWidth);
    //console.log('location: ' + page_height + " " + page_width);
    //make clickable the area
    let element = document.createElement('a'),
      attributes =
        'display:block; width:' +
        width +
        'px; height:' +
        height +
        'px; position:absolute; top:' +
        y +
        'px; left:' +
        x +
        'px;';

    if (bib) {
      // this is a bibliographical reference
      // we draw a line
      if (url) {
        element.setAttribute(
          'style',
          attributes + 'border:2px; border-style:none none solid none; border-color: blue;'
        );
        element.setAttribute('href', url);
        element.setAttribute('target', '_blank');
      } else
        element.setAttribute(
          'style',
          attributes + 'border:1px; border-style:none none dotted none; border-color: gray;'
        );
      element.setAttribute('id', theId);
    } else {
      // this is a reference marker
      // we draw a box
      element.setAttribute('style', attributes + 'border:1px solid; border-color: blue;');
      // the link here goes to the bibliographical reference
      if (theId) {
        element.onclick = function() {
          ModalManager.goToByScroll(theId);
        };
      }
      // we need the area where the actual target bibliographical reference is
      if (theBibPos) {
        element.setAttribute('data-toggle', 'popover');
        element.setAttribute('data-placement', 'top');
        element.setAttribute('data-content', 'content');
        element.setAttribute('data-trigger', 'hover');
        let newWidth = theBibPos.w * scale_x,
          newHeight = theBibPos.h * scale_y,
          newImg = ModalManager.getImagePortion(
            theBibPos.p,
            newWidth,
            newHeight,
            theBibPos.x * scale_x,
            theBibPos.y * scale_y
          );
        $(element).popover({
          'content': function() {
            return '<img src="' + newImg + '" style="width:100%" />';
          },
          //return '<img src=\"'+ newImg + '\" />';
          'html': true,
          'container': '#gluttonPdf'
          //width: newWidth + 'px',
          //height: newHeight + 'px'
          //          container: canvas,
          //width: '600px',
          //height: '100px'
        });
      }
    }
    annotationsContainer.append(element);
  },
  /* croping an area from a canvas */
  'getImagePortion': function(page, width, height, x, y) {
    //console.log("page: " + page + ", width: " + width + ", height: " + height + ", x: " + x + ", y: " + y);
    // get the page div
    let pageDiv = $('#gluttonPdf .page[data-page-number="' + page + '"]');
    // get the source canvas
    let canvas = pageDiv.find('.canvasWrapper > canvas').get(0);
    console.log(canvas);
    // the destination canvas
    let tnCanvas = document.createElement('canvas');
    let tnCanvasContext = tnCanvas.getContext('2d');
    tnCanvas.width = width;
    tnCanvas.height = height;
    tnCanvasContext.drawImage(canvas, x, y, width, height, 0, 0, width, height);
    return tnCanvas.toDataURL();
  },
  'goToByScroll': function(id) {
    $('#gluttonPdf #viewer').animate({ 'scrollTop': $('#' + id).offset().top }, 'fast');
  }
};
