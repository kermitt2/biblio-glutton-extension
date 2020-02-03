/*
 * @prettier
 */
'use strict';

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
          <div>
            <button type="button" class="btn btn-sm btn-light btn-outline-secondary close" data-dismiss="modal" aria-label="Close">
              <span aria-hidden="true">&times;</span>
            </button>
          </div>
        </div>
      </div>
      <div class="modal-body">` +
    `
  <div id="modal-refbib">
    <div class="data-row">
      <div class='modal-subtitle'>About this Reference:</div>
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
        <input type="radio" name="citeType" id="chicagoa" value="chicagoa">
        <label for="chicagoa">Chicago A</label>
        <input type="radio" name="citeType" id="chicagob" value="chicagob">
        <label for="chicagob">Chicago B</label>
        <input type="radio" name="citeType" id="apa" value="apa">
        <label for="apa">APA</label>
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
  </div>` +
    `</div>
      <div class="modal-footer">
        <button type="button" class="btn btn-sm btn-light btn-outline-secondary" data-dismiss="modal">Close</button>
      </div>
    </div>
  </div>`,
  modalContainer =
    `<div class="modal fade" id="gluttonModal" tabindex="-1" role="dialog" aria-labelledby="gluttonModalLabel" aria-hidden="true">` +
    modalContent +
    `</div>`;

let ModalManager = {
  'dataView': {
    'keys': ['title', 'author', 'publisher', 'oaLink'],
    'data': {
      'publisher': { 'label': 'Publisher', 'type': 'text' },
      'title': {
        'label': 'Title',
        'type': 'text',
        'extractData': function(data) {
          return data[0];
        }
      },
      'author': {
        'label': 'First Author',
        'type': 'text',
        'extractData': function(data) {
          if (data[0]) return data[0].family + (data[0].given ? ', ' + data[0].given : '');
          else return 'No data available';
        }
      },
      'oaLink': { 'label': 'Open Access', 'type': 'href' },
      'gluttonId': { 'label': 'GluttonId', 'type': 'text' }
    }
  },
  'init': function(options) {
    ModalManager.options = options;
    if (options.SHOW_ISTEX) {
      ModalManager.dataView.keys.push('istexLink');
      ModalManager.dataView.data.istexLink = { 'label': 'ISTEX', 'type': 'href' };
    }
  },
  // Refresh openUrl button state
  'refreshOpenUrl': function(state) {
    if (typeof state !== 'undefined') {
      if (state) $('#openUrl').show();
      else $('#openUrl').hide();
      return $('#openUrl > button').attr('disabled', !state);
    } else {
      $('#openUrl').hide();
      return $('#openUrl > button').attr('disabled', true);
    }
  },

  // Refresh processPdf button state
  'refreshProcessPdfButton': function(state) {
    if (typeof state !== 'undefined') {
      if (state) $('#processPdf').show();
      else $('#processPdf').hide();
      return $('#processPdf > button').attr('disabled', !state);
    } else {
      $('#processPdf').hide();
      return $('#processPdf > button').attr('disabled', true);
    }
  },

  // Refresh refbib cite div
  'refreshRefbibCite': function(state) {
    $('#citeString > textearea').text('');
    if (typeof state !== 'undefined' && state) {
      $('#modal-cite').show();
    } else {
      $('#modal-cite').hide();
    }
    if (typeof state !== 'undefined') {
      return $('#processCopy > button').attr('disabled', true);
    }
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
        .attr('target', '_blank')
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
    if (ModalManager.options.SHOW_ISTEX && (typeof link === 'undefined' || !link)) link = refbib.istexLink;
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
    ModalManager.refreshRefbibCite(refbib);
    ModalManager.refreshCite();
  },
  'openUrl': function(cb) {
    return $('#openUrl').click(cb);
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
    return $('#citeType').click(ModalManager.refreshCite);
  },
  'refreshCite': function() {
    let citeType = ModalManager.getCiteType();
    return ModalManager.buildCite(citeType, GluttonLinkInserter.refbibs.current);
  },
  'showPdfLoadingLoop': function() {
    return $('body').css('cursor', 'progress');
  },
  'hidePdfLoadingLoop': function() {
    return $('body').css('cursor', 'default');
  }
};
