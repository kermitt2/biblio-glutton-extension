'use strict';
var port = chrome.runtime.connect(),
    page = {
      contentType: window.document.contentType
    }
  ;

port.postMessage(page);
