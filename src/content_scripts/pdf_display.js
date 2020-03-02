/*
 * @prettier
 */
'use strict';

let workerSrcPath = getWebExtensionURL('vendors/pdf.js/build/pdf.worker.js');

if (typeof pdfjsLib === 'undefined' || (!pdfjsLib && !pdfjsLib.getDocument)) {
  console.error('Please build the pdfjs-dist library using\n' + '  `gulp dist-install`');
}
// The workerSrc property shall be specified.
//
else pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrcPath;

// Some PDFs need external cmaps.
//
const CMAP_URL = getWebExtensionURL('vendors/pdf.js/build/generic/web/cmaps/'),
  CMAP_PACKED = true,
  VIEWPORT_SCALE = 1.33,
  pdf_viewer = {
    'createEmptyPage': function(num, width, height) {
      let page = document.createElement('div'),
        canvas = document.createElement('canvas'),
        wrapper = document.createElement('div'),
        textLayer = document.createElement('div');

      page.className = 'page';
      wrapper.className = 'canvasWrapper';
      textLayer.className = 'textLayer';

      page.setAttribute('data-loaded', 'false');
      page.setAttribute('data-page-number', num);

      canvas.width = width;
      canvas.height = height;
      page.style.width = `${width}px`;
      page.style.height = `${height}px`;
      wrapper.style.width = `${width}px`;
      wrapper.style.height = `${height}px`;
      textLayer.style.width = `${width}px`;
      textLayer.style.height = `${height}px`;

      canvas.setAttribute('id', `page${num}`);

      page.appendChild(wrapper);
      page.appendChild(textLayer);
      wrapper.appendChild(canvas);

      return page;
    },
    'loadPage': function(viewer, numPage, pdfPage, callback) {
      let viewport = pdfPage.getViewport({ 'scale': VIEWPORT_SCALE }),
        page = pdf_viewer.createEmptyPage(numPage, viewport.width, viewport.height),
        canvas = page.querySelector('canvas'),
        wrapper = page.querySelector('.canvasWrapper'),
        container = page.querySelector('.textLayer'),
        canvasContext = canvas.getContext('2d');

      viewer.appendChild(page);

      pdfPage
        .render({
          'canvasContext': canvasContext,
          'viewport': viewport
        })
        .promise.then(function() {
          return pdfPage.getTextContent().then(function(textContent) {
            pdfjsLib.renderTextLayer({
              textContent,
              container,
              viewport,
              textDivs: []
            });
            page.setAttribute('data-loaded', 'true');
            return callback(pdfPage);
          });
        });
    }
  },
  PdfManager = {
    'showPdfLoadingLoop': function() {
      $('body').css('cursor', 'progress');
      return $('#gluttonPdfLoadingLoop').show();
    },
    'hidePdfLoadingLoop': function() {
      $('body').css('cursor', 'default');
      return $('#gluttonPdfLoadingLoop').hide();
    },
    'init': function() {
      $('#gluttonPdf')
        .append('<div id="viewerContainer"></div>')
        .append(
          '<img id="gluttonPdfLoadingLoop" src="' +
            getWebExtensionURL('vendors/pdf.js/build/components/images/loading-icon.gif') +
            '" />'
        );
      PdfManager.showPdfLoadingLoop();
    },
    // Refresh pdf display
    'refreshPdf': function(pdfUrl, annotationsUrl) {
      return $.ajax({
        'method': 'GET',
        'url': pdfUrl,
        'dataType': false,
        'xhr': function() {
          var myXhr = $.ajaxSettings.xhr();
          myXhr.responseType = 'arraybuffer';
          return myXhr;
        }
      })
        .done(function(buffer) {
          return $.ajax({
            'method': 'GET',
            'url': annotationsUrl,
            'dataType': 'json'
          })
            .done(function(annotations) {
              GluttonLinkInserter.disabled = true; // Disable GluttonLinkInserter
              const pdfContainer = $('#gluttonPdf #viewerContainer');
              pdfContainer.empty().append('<div id="viewer" class="pdfViewer"></div>');

              let viewer = document.getElementById('viewer');

              // Loading document.
              let loadingTask = pdfjsLib.getDocument({
                'data': buffer,
                'cMapUrl': CMAP_URL,
                'cMapPacked': CMAP_PACKED
              });

              PdfManager.hidePdfLoadingLoop();
              loadingTask.promise
                .then(function(pdfDocument) {
                  let pageRendered = 0;
                  for (let i = 0; i < pdfDocument.numPages; i++) {
                    let numPage = i + 1;
                    pdfDocument.getPage(numPage).then(function(pdfPage) {
                      pdf_viewer.loadPage(viewer, numPage, pdfPage, function(page) {
                        pageRendered++;
                        if (pageRendered >= pdfDocument.numPages) PdfManager.setupAnnotations(annotations);
                      });
                    });
                  }
                })
                .catch(e => {
                  console.log(e);
                  const pdfContainer = $('#gluttonPdf #viewerContainer');
                  pdfContainer.empty().append('<div>An error has occurred while PDF processing</div>');
                });
            })
            .fail(function() {
              const pdfContainer = $('#gluttonPdf #viewerContainer');
              pdfContainer.empty().append('<div>An error has occurred : PDF annotations not found</div>');
            });
        })
        .fail(function() {
          const pdfContainer = $('#gluttonPdf #viewerContainer');
          pdfContainer.empty().append('<div>An error has occurred : PDF not found</div>');
        });
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
            PdfManager.annotateBib(true, theId, thePos, theUrl, page_height, page_width, null);
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
            PdfManager.annotateBib(false, theId, annotation, null, page_height, page_width, theBibPos);
            //}
          } else {
            let pageNumber = annotation.p;
            if (pageInfo[pageNumber - 1]) {
              page_height = pageInfo[pageNumber - 1].page_height;
              page_width = pageInfo[pageNumber - 1].page_width;
            }
            PdfManager.annotateBib(false, theId, annotation, null, page_height, page_width, null);
          }
        });
      }
    },
    'annotateBib': function(bib, theId, thePos, url, page_height, page_width, theBibPos) {
      let page = thePos.p,
        canvas = $('#gluttonPdf .page[data-page-number="' + page + '"] .canvasWrapper > canvas'),
        annotationsContainer = $('#gluttonPdf .page[data-page-number="' + page + '"] .gluttonAnnotations div'),
        canvasHeight = canvas.height(),
        canvasWidth = canvas.width(),
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
      }
      // we need the area where the actual target bibliographical reference is
      if (theBibPos) {
        // the link here goes to the bibliographical reference
        if (theId) {
          element.onclick = function() {
            PdfManager.goToByScroll(theBibPos.p, theId);
          };
          let newWidth = theBibPos.w * scale_x,
            newHeight = theBibPos.h * scale_y,
            newImg = PdfManager.getImagePortion(
              theBibPos.p,
              newWidth,
              newHeight,
              theBibPos.x * scale_x,
              theBibPos.y * scale_y
            );
          $(element).popover({
            'toggle': 'popover',
            'placement': 'top',
            'trigger': 'hover',
            'content': function() {
              return '<img src="' + newImg + '" style="max-width:100%; width: 100%;"/>';
            },
            //return '<img src=\"'+ newImg + '\" />';
            'html': true,
            'container': 'body'
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
      // get the page div
      let pageDiv = $('#gluttonPdf .page[data-page-number="' + page + '"]');
      // get the source canvas
      let canvas = pageDiv.find('.canvasWrapper > canvas').get(0);
      // the destination canvas
      let tnCanvas = document.createElement('canvas');
      let tnCanvasContext = tnCanvas.getContext('2d');
      tnCanvas.width = width;
      tnCanvas.height = height;
      tnCanvasContext.drawImage(canvas, x, y, width, height, 0, 0, width, height);
      return tnCanvas.toDataURL();
    },
    'goToByScroll': function(page, id) {
      $('body').animate(
        { 'scrollTop': $('.page[data-page-number="' + page + '"').get(0).offsetTop + $('#' + id).get(0).offsetTop },
        'fast'
      );
    }
  };
