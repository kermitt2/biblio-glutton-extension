/*
 * @prettier
 */
const DEFAULT = {
  'SHOW_ISTEX': false,
  'GROBID_URL': 'http://localhost:8070/api',
  // 'GROBID_URL': 'http://cloud.science-miner.com/grobid/api',
  'GLUTTON_URL': 'http://cloud.science-miner.com/glutton/service'
};

function saveOptions(e) {
  e.preventDefault();
  let grobid = $('#grobid-url'),
    glutton = $('#glutton-url');
  grobid.val(grobid.val().replace(/\/+$/, '')); // remove last slash(es)
  glutton.val(glutton.val().replace(/\/+$/, '')); // remove last slash(es)
  if (typeof browser !== 'undefined')
    browser.storage.local.set({
      'SHOW_ISTEX': $('#show-istex').is(':checked'),
      'GROBID_URL': $('#grobid-url').val() || DEFAULT.GROBID_URL,
      'GLUTTON_URL': $('#glutton-url').val() || DEFAULT.GLUTTON_URL
    });
  else
    chrome.storage.local.set(
      {
        'SHOW_ISTEX': $('#show-istex').is(':checked'),
        'GROBID_URL': $('#grobid-url').val() || DEFAULT.GROBID_URL,
        'GLUTTON_URL': $('#glutton-url').val() || DEFAULT.GLUTTON_URL
      },
      function() {
        if (chrome.runtime.lastError) alert('error chrome.storage.local.set', chrome.runtime.lastError);
      }
    );
}

if (typeof browser !== 'undefined') {
  function restoreOptions() {
    function setCurrentChoice(settings) {
      $('#show-istex').attr(
        'checked',
        typeof settings.SHOW_ISTEX !== 'undefined' ? settings.SHOW_ISTEX : DEFAULT.SHOW_ISTEX
      );
      $('#grobid-url').val(typeof settings.GROBID_URL !== 'undefined' ? settings.GROBID_URL : DEFAULT.GROBID_URL);
      $('#glutton-url').val(typeof settings.GLUTTON_URL !== 'undefined' ? settings.GLUTTON_URL : DEFAULT.GLUTTON_URL);
    }
    function onError(error) {
      alert(`Error: ${error}`);
    }
    let getting = browser.storage.local.get();
    getting.then(setCurrentChoice, onError);
  }
  document.addEventListener('DOMContentLoaded', restoreOptions);
} else {
  document.addEventListener('DOMContentLoaded', function() {
    chrome.storage.local.get(null, function(settings) {
      if (chrome.runtime.lastError) alert(chrome.runtime.lastError);
      $('#show-istex').attr(
        'checked',
        typeof settings.SHOW_ISTEX !== 'undefined' ? settings.SHOW_ISTEX : DEFAULT.SHOW_ISTEX
      );
      $('#grobid-url').val(typeof settings.GROBID_URL !== 'undefined' ? settings.GROBID_URL : DEFAULT.GROBID_URL);
      $('#glutton-url').val(typeof settings.GLUTTON_URL !== 'undefined' ? settings.GLUTTON_URL : DEFAULT.GLUTTON_URL);
    });
  });
}

$('input').on('change', saveOptions);
