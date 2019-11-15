/*
 * @prettier
 */
'use strict';

function saveOptions(e) {
  e.preventDefault();
  let grobid = $('#grobid-url'),
    glutton = $('#glutton-url');
  grobid.val(grobid.val().replace(/\/+$/, '')); // remove last slash(es)
  glutton.val(glutton.val().replace(/\/+$/, '')); // remove last slash(es)
  chrome.storage.local.set(
    {
      'SHOW_ISTEX': $('#show-istex').is(':checked'),
      'GROBID_URL': $('#grobid-url').val() || DEFAULT_OPTIONS.GROBID_URL,
      'GLUTTON_URL': $('#glutton-url').val() || DEFAULT_OPTIONS.GLUTTON_URL
    },
    function() {
      if (chrome.runtime.lastError) alert('error chrome.storage.local.set', chrome.runtime.lastError);
    }
  );
}

document.addEventListener('DOMContentLoaded', function() {
  chrome.storage.local.get(null, function(settings) {
    if (chrome.runtime.lastError) alert(chrome.runtime.lastError);
    $('#show-istex').attr(
      'checked',
      typeof settings.SHOW_ISTEX !== 'undefined' ? settings.SHOW_ISTEX : DEFAULT_OPTIONS.SHOW_ISTEX
    );
    $('#grobid-url').val(typeof settings.GROBID_URL !== 'undefined' ? settings.GROBID_URL : DEFAULT_OPTIONS.GROBID_URL);
    $('#glutton-url').val(
      typeof settings.GLUTTON_URL !== 'undefined' ? settings.GLUTTON_URL : DEFAULT_OPTIONS.GLUTTON_URL
    );
  });
});

$('input').on('change', saveOptions);
