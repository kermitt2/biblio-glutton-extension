/*
 * @prettier
 */
'use strict';

const getWebExtensionURL = function(url) {
  return typeof browser !== 'undefined' ? browser.runtime.getURL(url) : chrome.runtime.getURL(url);
};
