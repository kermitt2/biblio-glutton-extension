function saveOptions(e) {
  e.preventDefault();
  console.log($('#show-istex').is(':checked'));
  browser.storage.local.set({
    'show-istex': $('#show-istex').is(':checked')
  });
}

function restoreOptions() {
  function setCurrentChoice(result) {
    $('#show-istex').attr('checked', result['show-istex'] || false);
  }

  function onError(error) {
    console.log(`Error: ${error}`);
  }

  let getting = browser.storage.local.get();
  getting.then(setCurrentChoice, onError);
}

document.addEventListener('DOMContentLoaded', restoreOptions);
$('input').on('change', saveOptions);
