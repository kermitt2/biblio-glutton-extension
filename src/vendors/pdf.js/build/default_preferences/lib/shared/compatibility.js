"use strict";

if (typeof globalThis === 'undefined' || !globalThis._pdfjsCompatibilityChecked) {
  if (typeof globalThis === 'undefined' || globalThis.Math !== Math) {
    globalThis = require('core-js/es/global-this');
  }

  globalThis._pdfjsCompatibilityChecked = true;

  const {
    isNodeJS
  } = require('./is_node');

  const hasDOM = typeof window === 'object' && typeof document === 'object';
  const userAgent = typeof navigator !== 'undefined' && navigator.userAgent || '';
  const isIE = /Trident/.test(userAgent);

  (function checkNodeBtoa() {
    if (globalThis.btoa || !isNodeJS) {
      return;
    }

    globalThis.btoa = function (chars) {
      return Buffer.from(chars, 'binary').toString('base64');
    };
  })();

  (function checkNodeAtob() {
    if (globalThis.atob || !isNodeJS) {
      return;
    }

    globalThis.atob = function (input) {
      return Buffer.from(input, 'base64').toString('binary');
    };
  })();

  (function checkChildNodeRemove() {
    if (!hasDOM) {
      return;
    }

    if (typeof Element.prototype.remove !== 'undefined') {
      return;
    }

    Element.prototype.remove = function () {
      if (this.parentNode) {
        this.parentNode.removeChild(this);
      }
    };
  })();

  (function checkDOMTokenListAddRemove() {
    if (!hasDOM || isNodeJS) {
      return;
    }

    const div = document.createElement('div');
    div.classList.add('testOne', 'testTwo');

    if (div.classList.contains('testOne') === true && div.classList.contains('testTwo') === true) {
      return;
    }

    const OriginalDOMTokenListAdd = DOMTokenList.prototype.add;
    const OriginalDOMTokenListRemove = DOMTokenList.prototype.remove;

    DOMTokenList.prototype.add = function (...tokens) {
      for (let token of tokens) {
        OriginalDOMTokenListAdd.call(this, token);
      }
    };

    DOMTokenList.prototype.remove = function (...tokens) {
      for (let token of tokens) {
        OriginalDOMTokenListRemove.call(this, token);
      }
    };
  })();

  (function checkDOMTokenListToggle() {
    if (!hasDOM || isNodeJS) {
      return;
    }

    const div = document.createElement('div');

    if (div.classList.toggle('test', 0) === false) {
      return;
    }

    DOMTokenList.prototype.toggle = function (token) {
      let force = arguments.length > 1 ? !!arguments[1] : !this.contains(token);
      return this[force ? 'add' : 'remove'](token), force;
    };
  })();

  (function checkWindowHistoryPushStateReplaceState() {
    if (!hasDOM || !isIE) {
      return;
    }

    const OriginalPushState = window.history.pushState;
    const OriginalReplaceState = window.history.replaceState;

    window.history.pushState = function (state, title, url) {
      const args = url === undefined ? [state, title] : [state, title, url];
      OriginalPushState.apply(this, args);
    };

    window.history.replaceState = function (state, title, url) {
      const args = url === undefined ? [state, title] : [state, title, url];
      OriginalReplaceState.apply(this, args);
    };
  })();

  (function checkStringStartsWith() {
    if (String.prototype.startsWith) {
      return;
    }

    require('core-js/es/string/starts-with');
  })();

  (function checkStringEndsWith() {
    if (String.prototype.endsWith) {
      return;
    }

    require('core-js/es/string/ends-with');
  })();

  (function checkStringIncludes() {
    if (String.prototype.includes) {
      return;
    }

    require('core-js/es/string/includes');
  })();

  (function checkArrayIncludes() {
    if (Array.prototype.includes) {
      return;
    }

    require('core-js/es/array/includes');
  })();

  (function checkArrayFrom() {
    if (Array.from) {
      return;
    }

    require('core-js/es/array/from');
  })();

  (function checkObjectAssign() {
    if (Object.assign) {
      return;
    }

    require('core-js/es/object/assign');
  })();

  (function checkMathLog2() {
    if (Math.log2) {
      return;
    }

    Math.log2 = require('core-js/es/math/log2');
  })();

  (function checkNumberIsNaN() {
    if (Number.isNaN) {
      return;
    }

    Number.isNaN = require('core-js/es/number/is-nan');
  })();

  (function checkNumberIsInteger() {
    if (Number.isInteger) {
      return;
    }

    Number.isInteger = require('core-js/es/number/is-integer');
  })();

  (function checkPromise() {
    if (globalThis.Promise && globalThis.Promise.prototype && globalThis.Promise.prototype.finally) {
      return;
    }

    globalThis.Promise = require('core-js/es/promise/index');
  })();

  (function checkURL() {
    globalThis.URL = require('core-js/web/url');
  })();

  (function checkReadableStream() {
    let isReadableStreamSupported = false;

    if (typeof ReadableStream !== 'undefined') {
      try {
        new ReadableStream({
          start(controller) {
            controller.close();
          }

        });
        isReadableStreamSupported = true;
      } catch (e) {}
    }

    if (isReadableStreamSupported) {
      return;
    }

    globalThis.ReadableStream = require('web-streams-polyfill/dist/ponyfill').ReadableStream;
  })();

  (function checkWeakMap() {
    if (globalThis.WeakMap) {
      return;
    }

    globalThis.WeakMap = require('core-js/es/weak-map/index');
  })();

  (function checkWeakSet() {
    if (globalThis.WeakSet) {
      return;
    }

    globalThis.WeakSet = require('core-js/es/weak-set/index');
  })();

  (function checkStringCodePointAt() {
    if (String.prototype.codePointAt) {
      return;
    }

    require('core-js/es/string/code-point-at');
  })();

  (function checkStringFromCodePoint() {
    if (String.fromCodePoint) {
      return;
    }

    String.fromCodePoint = require('core-js/es/string/from-code-point');
  })();

  (function checkSymbol() {
    if (globalThis.Symbol) {
      return;
    }

    require('core-js/es/symbol/index');
  })();

  (function checkStringPadStart() {
    if (String.prototype.padStart) {
      return;
    }

    require('core-js/es/string/pad-start');
  })();

  (function checkStringPadEnd() {
    if (String.prototype.padEnd) {
      return;
    }

    require('core-js/es/string/pad-end');
  })();

  (function checkObjectValues() {
    if (Object.values) {
      return;
    }

    Object.values = require('core-js/es/object/values');
  })();
}