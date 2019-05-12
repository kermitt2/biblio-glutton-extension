'use strict';

function log (message) {
  if (!console || !console.log) return;
  if (isObject(message) && console.dir && arguments.length === 1) {
    console.dir(message);
    return;
  }
  console.log.apply(null, arguments);
}

function trace (message) {
  log.apply(null, arguments);

  if (console.trace) {
    console.trace('\n\n');
    console.log('\n\n');
  } else {
    console.log('%c' + (new Error().stack || '').split('\n').slice(1).join('\n') + '\n\n', 'color: #9e9ea6');
  }
}

function info () {
  var args = Array.prototype.slice.call(arguments);
  args.unshift('%cbiblio-glutton-extension: %c%s', 'color:#337ab7;font-weight:bold;', 'color: #51515d;');
  console.info.apply(null, args);
}

function warn (message) {
  if (!console || !console.warn) return log(message);
  console.warn.apply(null, arguments);
}

function error () {
  if (!(config && config.mustDebug)) return;
  if (!console || !console.error) return log.apply(null, arguments);
  console.error.apply(null, arguments);
}

function debug (message) {
  if (!(config && config.mustDebug)) return;
  warn('biblio-glutton-extension: ' + message);
}

function logXhrError (url, statusText) {
  console.error('%cbiblio-glutton-extension:%c %s %c %s',
                'color:red;font-weight:bold;',
                'color: #51515d;',
                url,
                'color:red;font-weight:bold;',
                statusText);
}
function isObject (value) {
  return value && 'object' === typeof value || 'function' === typeof value;
}
