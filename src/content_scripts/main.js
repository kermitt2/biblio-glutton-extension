/* globals LZString, warn, error, debug, logXhrError */
'use strict';

var config,
    GluttonLinkInserter,
    NOT_AVAILABLE = 'NA'
;
const forbidenElements = ['applet',
                          'area',
                          'audio',
                          'br',
                          'canvas',
                          'center',
                          'embed',
                          'frame',
                          'frameset',
                          'hr',
                          'iframe',
                          'img',
                          'input',
                          'keygen',
                          'link',
                          'map',
                          'meta',
                          'meter',
                          'noframes',
                          'noscript',
                          'object',
                          'optgroup',
                          'option',
                          'output',
                          'param',
                          'picture',
                          'progress',
                          'script',
                          'select',
                          'source',
                          'textarea',
                          'time',
                          'track',
                          'video',
                          'wbr',
                          'svg',
                          'g',
                          'path',
                          'text',
                          'rect'];

config = {
  gluttonBaseURL: 'cloud.science-miner.com/glutton',
  maxPageLinks: 2500,
  mustDebug   : false
};

GluttonLinkInserter = {
  // OpenURL static info
  openUrlVersion: 'Z39.88-2004',
  openURLPrefix : 'http://cloud.science-miner.com/glutton?',

  // DOI pattern
  doiPattern                 : /\/\/((dx\.)?doi\.org|doi\.acm\.org|dx\.crossref\.org).*\/(10\..*(\/|%2(F|f)).*)/,
  // the index of the group where to find the DOI
  doiGroup                   : 3,
  regexDoiPatternConservative: new RegExp('(10\\.\\d{4,5}\\/[\\S]+[^;,.\\s])', 'gi'),

  // PMID
  pubmedPattern         : new RegExp('http.*\\/\\/.*ncbi\\.nlm\\.nih\\.gov.*\\/pubmed.*(\\/|=)([0-9]{4,12})', 'i'),
  pubmedGroup           : 1,
  regexPMIDPattern      : new RegExp('(PubMed\\s?(ID\\s?:?|:)|PM\\s?ID)[\\s:\\/]?\\s*([0-9]{4,12})', 'gi'),
  regexPrefixPMIDPattern: new RegExp('((PubMed\\s?(ID)?:?)|(PM\\s?ID))[\\s:\\/]*$', 'i'),
  regexSuffixPMIDPattern: new RegExp('^\\s*[:\\/]?\\s*([0-9]{4,12})', 'i'),
  skipPattern           : new RegExp('^[:\\/\\s]+$', 'i'),

  // PII pattern in links
  regexPIIPattern: new RegExp('\\pii\\/([A-Z0-9]{16,20})', 'gi'),

  // The last group should be the parameters for openurl resolver
  openUrlPattern: /.*(sfxhosted|sfx?|search|.hosted).(exlibrisgroup|serialssolutions).com.*(\/|%2(F|f))?\?*(.*)/,
  flags         : {
    OPEN_URL_BASE         : 1,
    DOI_ADDRESS           : 2,
    PUBMED_ADDRESS        : 3,
    HAS_OPEN_URL          : 4,
    HAS_PII               : 5,
    GOOGLE_SCHOLAR_OPENURL: 6,
    SCOPUS_DOI            : 7
  },

  scopusExternalLinkPrefix: 'www.scopus.com/redirect/linking.uri?targetURL=',

  onDOMContentLoaded: function() {
    var rootElement = document.documentElement;
    // check if we have an html page
    debug(document.contentType);
    if (document.contentType === 'text/html') {
      var currentUrl = window.location.href;
      if (currentUrl.indexOf('grobid') === -1) {
        GluttonLinkInserter.findAndReplaceLinks(rootElement);
        rootElement.addEventListener('DOMNodeInserted', GluttonLinkInserter.onDOMNodeInserted, false);
      }
    }

  },

  onDOMNodeInserted: function(event) {
    var node = event.target;
    GluttonLinkInserter.findAndReplaceLinks(node);
  },

  scanForDoiAndPubmedStrings: function(domNode, prefixStatus) {
    var prefix = prefixStatus;
    // Only process valid dom nodes:
    if (domNode === null || !domNode.getElementsByTagName) {
      return prefix;
    }

    if (forbidenElements.includes(domNode.tagName.toLowerCase())) return false;

    // if the node is already clickable
    if (domNode.tagName.toLowerCase() === 'a') {
      return false;
    }

    var childNodes = domNode.childNodes,
        childNode,
        spanElm,
        i          = 0,
        text
    ;

    while ((childNode = childNodes[i])) {
      if (childNode.nodeType === 3) { // text node found, do the replacement
        text = childNode.textContent;
        if (text) {
          var matchDOI  = text.match(this.regexDoiPatternConservative);
          var matchPMID = text.match(this.regexPMIDPattern);
          if (matchDOI || matchPMID) {
            spanElm = document.createElement('span');
            spanElm.setAttribute('name', 'GluttonInserted');

            if (matchDOI) {
              spanElm.innerHTML = text.replace(this.regexDoiPatternConservative,
                                               '<a href="http://dx.doi.org/$1" name="GluttonInserted">$1</a>');
              text              = spanElm.innerHTML;
            }
            if (matchPMID) {
              spanElm.innerHTML =
                text
                  .replace(this.regexPMIDPattern,
                           '<a href="http://www.ncbi.nlm.nih.gov/pubmed/$3" name="GluttonInserted">PubMed ID $3</a>'
                  );
            }
            domNode.replaceChild(spanElm, childNode);
            childNode = spanElm;
            text      = spanElm.innerHTML;
            prefix    = false;
          }
          else {
            if (prefix && (text.match(this.regexSuffixPMIDPattern))) {
              debug('regexSuffixPMIDPattern: ' + text);
              spanElm = document.createElement('span');
              spanElm.setAttribute('name', 'GluttonInserted');
              spanElm.innerHTML = text.replace(this.regexSuffixPMIDPattern,
                                               '<a href=\'http://www.ncbi.nlm.nih.gov/pubmed/$1\' name=\'GluttonInserted\'>$1</a>');
              domNode.replaceChild(spanElm, childNode);
              childNode = spanElm;
              text      = spanElm.innerHTML;
              prefix    = false;
            }
            else if (text.match(this.regexPrefixPMIDPattern)) {
              debug('regexPrefixPMIDPattern: ' + text);
              prefix = true;
            }
            else if (text.length > 0) {
              if (!text.match(this.skipPattern)) {
                prefix = false;
              }
            }
          }
        }
      }
      else if (childNode.nodeType === 1) { // not a text node but an element node, we look forward
        prefix = this.scanForDoiAndPubmedStrings(childNode, prefix);
      }
      i++;
    }
    return prefix;
  },

  findAndReplaceLinks: function(domNode) {
    // Only process valid domNodes:
    if (!domNode || !domNode.getElementsByTagName) return;

    this.scanForDoiAndPubmedStrings(domNode, false);

    // Detect OpenURL, DOI or PII links not already handled in the code above and replace them with our custom links
    var links = domNode.getElementsByTagName('a');

    if (links.length > config.maxPageLinks) {
      warn('Too many links for Glutton analyser:' + links.length);
      return;
    }

    for (var i = 0; i < links.length; i++) {
      var link  = links[i];
      var flags = this.analyzeLink(link);

      if (flags === 0) {
        continue;
      }

      var href = decodeURIComponent(link.getAttribute('href'));

      // We have found an open url link:
      if (flags === this.flags.HAS_OPEN_URL) {
        // OpenURl
        this.createOpenUrlLink(href, link);
      }
      else if (flags === this.flags.DOI_ADDRESS) {
        // doi
        this.createDoiLink(href, link);
      }
      else if (flags === this.flags.GOOGLE_SCHOLAR_OPENURL) {
        this.createGoogleScholarLink(href, link);
      }
      else if (flags === this.flags.PUBMED_ADDRESS) {
        // PubMed ID
        this.createPubmedLink(href, link);
      }
      else if (flags === this.flags.HAS_PII) {
        // Publisher Item Identifier
        this.createPIILink(href, link);
      } else if (flags === this.flags.SCOPUS_DOI) {
        // scopus external publisher link
        this.createScopusLink(href, link);
      }

    }

    this.createSpanBasedLinks(domNode);
  },

  analyzeLink: function(link) {
    // First check if we have to bother:
    var mask = 0;

    if (!link.getAttribute('href')) {
      return mask;
    }

    var href       = link.getAttribute('href');
    var currentUrl = window.location.href;
    if (link.getAttribute('name') === 'GluttonVisited') {
      return mask;
    }
    if (link.getAttribute('classname') === 'glutton-link') {
      return mask;
    }
    if (href.indexOf(config.gluttonBaseURL) !== -1) {
      return mask;
    }

    // check if we have a Google Scholar pre-OpenURL link (the link that will call the OpenURL)
    // we can support ISTEX full text only for the moment, as Google Scholar has a config only
    // for it (we would need to add one for Unpaywall in theory to have those Open Access links there)
    var contentText = link.textContent;
    if (href.indexOf('scholar.google.') !== -1 && (contentText === '[PDF] ISTEX')) {
      mask = this.flags.GOOGLE_SCHOLAR_OPENURL;
      //return mask;
    } else if (href.indexOf(this.scopusExternalLinkPrefix) !== -1) {
      // check scopus external publisher links
      var simpleHref = href.replace('https://' + this.scopusExternalLinkPrefix, '');
      simpleHref     = decodeURIComponent(simpleHref);
      var ind        = simpleHref.indexOf('&');
      if (ind !== -1)
        simpleHref = simpleHref.substring(0, ind);
      if (simpleHref.match(this.doiPattern)) {
        mask = this.flags.SCOPUS_DOI;
      }
    } else if ((href.indexOf('doi.org') !== -1 ||
                href.indexOf('doi.acm.org') !== -1 ||
                href.indexOf('dx.crossref.org') !== -1)
               && href.match(this.doiPattern)) {
      // Check if the href contains a DOI link
      mask = this.flags.DOI_ADDRESS;
    } else if (href.indexOf('ncbi.nlm.nih.gov') !== -1 && this.pubmedPattern.test(href)) {
      // Check if the href contains a PMID link
      mask = this.flags.PUBMED_ADDRESS;
    } else if (this.regexPIIPattern.test(href) && currentUrl.indexOf('scholar.google.') === -1) {
      // Check if the href contains a PII link
      mask = this.flags.HAS_PII;
    } else if (href.indexOf('exlibrisgroup.com') !== -1 && this.openUrlPattern.test(href)) {
      // Check if the href contains a supported reference to an open url link
      mask = this.flags.OPEN_URL_BASE;
    } else if (href.indexOf('serialssolutions.com') !== -1 && this.openUrlPattern.test(href)) {
      if (link.getAttribute('class') !== 'documentLink') {
        mask = this.flags.OPEN_URL_BASE;
      }
    }

    if (config.mustDebug && mask > 0) {
      debug('URL is ' + href + '\n mask value: ' + mask);
    }

    return mask;
  },

  createOpenUrlLink: function(href, link) {
    var matchInfo = this.openUrlPattern.exec(href);
    if (!matchInfo) return;
    // the last group should be the parameters:
    var child = this.buildButton(matchInfo[matchInfo.length - 1]);
    link.parentNode.replaceChild(child, link);
  },

  createDoiLink: function(href, link) {
    var matchInfo = this.doiPattern.exec(href);
    if (matchInfo.length < this.doiGroup) {
      return;
    }
    var doiString = matchInfo[this.doiGroup];
    var gluttonUrl  = 'rft_id=info:doi/' + doiString;
    var newLink   = this.buildButton(gluttonUrl);
    link.parentNode.insertBefore(newLink, link.nextSibling);
    link.setAttribute('name', 'GluttonVisited');
  },

  createScopusLink: function(href, link) {
    var simpleHref = href.replace('https://' + this.scopusExternalLinkPrefix, '');
    simpleHref     = decodeURIComponent(simpleHref);
    var ind        = simpleHref.indexOf('&');
    if (ind !== -1)
      simpleHref = simpleHref.substring(0, ind);

    var matchInfo = this.doiPattern.exec(simpleHref);
    if (matchInfo.length < this.doiGroup) {
      return;
    }
    var doiString = matchInfo[this.doiGroup];
    var gluttonUrl  = 'rft_id=info:doi/' + doiString;
    var newLink   = this.buildButton(gluttonUrl);
    newLink.setAttribute('style', 'visibility:visible;');
    link.parentNode.insertBefore(newLink, link.nextSibling);
    link.setAttribute('name', 'GluttonVisited');
  },

  createPubmedLink: function(href, link) {
    var gluttonUrl =
          href.replace(
            this.pubmedPattern,
            'rft_id=info:pmid/$2&rft.genre=article,chapter,bookitem&svc.fulltext=yes'
          );
    var newLink  = this.buildButton(gluttonUrl);
    link.parentNode.insertBefore(newLink, link.nextSibling);
    link.setAttribute('name', 'GluttonVisited');
  },

  createPIILink: function(href, link) {
    var matches = href.match(this.regexPIIPattern);
    if (matches && (matches.length > 0)) {
      var gluttonUrl = 'rft_id=info:' + matches[0] + '&rft.genre=article,chapter,bookitem&svc.fulltext=yes';
      var newLink  = this.buildButton(gluttonUrl);
      link.parentNode.insertBefore(newLink, link.nextSibling);
      link.setAttribute('name', 'GluttonVisited');
    }
  },

  createGoogleScholarLink: function(href, link) {
    // we can only support ISTEX resources here we make the glutton button with the existing google scholar 
    // url which will call the ISTEX OpenURL service
    link.textContent = 'ISTEX';
    link.name        = 'ISTEXLink';
    link.className   = 'istex-link';
    link.target      = '_blank';
    //link.setAttribute('name', 'GluttonVisited');
  },

  // Wikipedia for instance is using COInS spans
  createSpanBasedLinks: function(doc) {
    // Detect latent OpenURL SPANS and replace them with Glutton links
    var spans = doc.getElementsByTagName('span');
    for (var i = 0, n = spans.length; i < n; i++) {
      var span  = spans[i];
      var query = span.getAttribute('title');

      // /Z3988 means OpenURL
      var clazzes = span.getAttribute('class') === null ? '' : span.getAttribute('class');
      var name    = span.getAttribute('name') === null ? '' : span.getAttribute('name');

      if ((name !== 'GluttonVisited') && (clazzes.match(/Z3988/i) !== null)) {
        query += '&url_ver=' + GluttonLinkInserter.openUrlVersion;
        var child = this.buildButton(query);
        span.appendChild(child);
        span.setAttribute('name', 'GluttonVisited');
      }


    }
  },
  /**
   * Make the Glutton button.
   *
   * @param {Object} href
   */
  buildButton         : function(href) {
    debug('making link: ' + this.openURLPrefix + href + '&noredirect&sid=glutton-browser-addon');

    var span = document.createElement('span');
    this.makeChild(href, document, span);
    return span;
  },

  createLink: function(resourceUrl) {
    // set the added link, this will avoid an extra call to the OpenURL API and fix the access url
    var a         = document.createElement('a');
    a.href        = resourceUrl.replace('/original', '/pdf')
    a.target      = '_blank';
    a.alt         = 'Glutton';
    a.name        = 'GluttonLink';
    a.className   = 'glutton-link';
    a.textContent = 'Glutton';

    return a;
  },

  makeChild: function(href, document, parent) {
    /*var key = LZString.compress(href),
        resourceUrl
    ;*/

    // insert the sid in the openurl for usage statistics reason
    if (!~href.indexOf('sid=')) {
      // sid is alone in the given openurl
      href += '&sid=glutton-browser-addon';
    } else {
      // sid is not alone in the given openurl
      // then we have to handle special case if
      // the sid value is empty
      // (ex: ?foo=bar&sid= or ?sid=&foo=bar)
      if (/sid=(&|$)/.test(href)) {
        href = href.replace('sid=', 'sid=glutton-browser-addon');
      } else {
        href = href.replace('sid=', 'sid=glutton-browser-addon,');
      }
    }

    var sid = this.parseQuery(href).sid;

    /*if ((resourceUrl = localStorage.getItem(key))) {
      if (resourceUrl === NOT_AVAILABLE) {
        parent = null;
        return;
      }
      parent
        .appendChild(
          GluttonLinkInserter.createLink(resourceUrl)
        );
      return;
    }*/

    var requestUrl = GluttonLinkInserter.openURLPrefix + href + '&noredirect'
    ;

    $.ajax(
      {
        url     : requestUrl,
        timeout : 16000,
        tryCount: 0,
        maxRetry: 1,
        success : function(data) {
          parent
          && parent.appendChild(
            GluttonLinkInserter.createLink(data.resourceUrl)
          );
        },
        error   : function(jqXHR, textStatus, errorThrown) {
          logXhrError(requestUrl, errorThrown);
          if (
            textStatus === 'timeout'
            && this.tryCount < this.maxRetry
          ) {
            info('Retry: ', this.url);
            this.tryCount++;
            return $.ajax(this);
          }
          // Todo fix the async behavior using callback style for element creation
          parent && parent.parentNode && parent.parentNode.removeChild(parent);
        },
        /*complete: function(jqXHR) {
          if (~[200, 300, 404].indexOf(jqXHR.status)) {
            if (!localStorage.getLastRefresh()) {
              localStorage.setLastRefresh();
            }
            localStorage.setItemOrClear(key, jqXHR.responseJSON.resourceUrl || NOT_AVAILABLE);
          }
        }*/
      }
    );
  },

  /**
   * To parse the querystring
   * (used for extracting sid value)
   */
  parseQuery: function(qstr) {
    var query  = {},
        paires = qstr.substring(1).split('&'),
        paire
    ;
    for (var i = 0; i < paires.length; i++) {
      paire = paires[i].split('=');
      try {
        query[decodeURIComponent(paire[0])]
          = decodeURIComponent(paire[1] || '');
      } catch (err) {
        error(err);
      }
    }
    return query;
  }

};

// We need to remove trace of the old way refresh Timestamp
/*if (localStorage.getItem('last-refesh')) {
  localStorage.clear();
}

if (!localStorage.getLastRefresh()) {
  setTimeout(GluttonLinkInserter.onDOMContentLoaded, 0);
} else {
  info('Check data freshness');
  $.ajax(
    {
      url     : 'https://api.istex.fr/properties',
      timeout : 5000,
      tryCount: 0,
      maxRetry: 1,
      success : function(data) {
        if (data.corpus.lastUpdate > localStorage.getLastRefresh()) {
          localStorage.refresh();
        }
        GluttonLinkInserter.onDOMContentLoaded();
      },
      error   : function(jqXHR, textStatus, errorThrown) {
        error(textStatus, errorThrown);
        if (textStatus === 'timeout' && this.tryCount < this.maxRetry) {
          info('Retry: ', this.url);
          this.tryCount++;
          return $.ajax(this);
        }
        GluttonLinkInserter.onDOMContentLoaded();
      }
    });
}
*/


