/*
 * @prettier
 */

let openTabQuery = { 'active': true, 'currentWindow': true };

window.onload = function() {
  browser.tabs.query(openTabQuery, function(tabs) {
    $('#title').text('#' + tabs[0].id + ' - ' + new Date().toLocaleString());
  });
};

function onOpened() {
  console.log(`Options page opened`);
}

function onError(error) {
  console.log(`Error: ${error}`);
}

$('#preferences').click(function() {
  let opening = browser.runtime.openOptionsPage();
  opening.then(onOpened, onError);
});
