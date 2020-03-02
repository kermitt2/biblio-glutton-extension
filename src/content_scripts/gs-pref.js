/*
 * @prettier
 */
'use strict';

window.onunload = function(e) {
  console.log('unload event');
  chrome.runtime.sendMessage({ text: 'done' });
};

// we need to send a click to this
// <button type="submit" name="save" class=" gs_btn_act"><span class="gs_wr"><span class="gs_lbl">Save</span></span></button>

$('.gs_btn_act').click();
