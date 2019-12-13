/*
 * @prettier
 */
'use strict';

const CITE = {
  // Build cite with Bibtex format
  'bibtex': function(refbib) {
    if (typeof refbib === 'undefined' || typeof refbib.publisher === 'undefined') return null;
    let author =
        typeof refbib.author !== 'undefined' && refbib.author.length > 0
          ? refbib.author[0].family + ',' + refbib.author[0].given
          : '',
      booktitle = refbib.title || '',
      month =
        typeof refbib.issued !== 'undefined' && typeof refbib.issued['date-parts'] !== 'undefined'
          ? refbib.issued['date-parts'][0][1]
          : '',
      pages = refbib.page || '',
      publisher = refbib.publisher || '',
      title = typeof refbib.title !== 'undefined' ? refbib.title[0] : '',
      type = refbib.type || '',
      url = typeof refbib.link !== 'undefined' && refbib.link.length > 0 ? refbib.link[0].URL : '',
      volume = refbib.volume || '',
      year =
        typeof refbib.issued !== 'undefined' && refbib.issued['date-parts'] && refbib.issued['date-parts'].length > 0
          ? refbib.issued['date-parts'][0][0]
          : '',
      result =
        '@book{' +
        // 'address="", ' +
        // 'abstract="", ' +
        // 'annote="", ' +
        'author="' +
        author +
        '", ' +
        'booktitle="' +
        booktitle +
        '", ' +
        // 'chapter="", ' +
        // 'crossref="", ' +
        // 'edition="", ' +
        // 'editor="", ' +
        // 'eprint="", ' +
        // 'howpublished="", ' +
        // 'institution="", ' +
        // 'journal="", ' +
        // 'key="", ' +
        'month="' +
        month +
        '" ' +
        // 'note="", ' +
        // 'number="", ' +
        // 'organization="", ' +
        'pages="' +
        pages +
        '", ' +
        'publisher="' +
        publisher +
        '", ' +
        // 'school="", ' +
        // 'series="", ' +
        'title="' +
        title +
        '", ' +
        'type="' +
        type +
        '", ' +
        'url="' +
        url +
        '", ' +
        'volume="' +
        volume +
        '", ' +
        'year="' +
        year +
        '" ' +
        '}';
    return result;
  }
};
