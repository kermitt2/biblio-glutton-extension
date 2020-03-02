/*
 * @prettier
 */
'use strict';

const CITE = {
  'data': {
    'getAuthors': function(refbib) {
      return Array.isArray(refbib.author) && refbib.author.length > 0
        ? refbib.author
            .map(function(author) {
              return (author.family ? author.family + ', ' : '') + (author.given ? author.given + '. ' : '');
            })
            .join('')
        : '';
    },
    'getNum': function(refbib) {
      return refbib.issue || '';
    },
    'getRevueName': function(refbib) {
      return typeof refbib.processCitation !== 'undefined' && typeof refbib.processCitation.mtitle !== 'undefined'
        ? refbib.processCitation.mtitle.text
        : refbib.publisher || '';
    },
    'getJTitle': function(refbib) {
      return typeof refbib.processCitation !== 'undefined' && typeof refbib.processCitation.jtitle !== 'undefined'
        ? refbib.processCitation.jtitle.text
        : '';
    },
    'getATitle': function(refbib) {
      return Array.isArray(refbib.title) && typeof refbib.title[0] !== 'undefined'
        ? refbib.title[0]
        : typeof refbib.processCitation !== 'undefined' && typeof refbib.processCitation.atitle !== 'undefined'
        ? refbib.processCitation.atitle.text
        : '';
    },
    'getOrgName': function(refbib) {
      return refbib.orgName || '';
    },
    'getAuthor': function(refbib) {
      return typeof refbib.author !== 'undefined' &&
        Array.isArray(refbib.author) &&
        typeof refbib.author[0] !== 'undefined'
        ? (refbib.author[0].family ? refbib.author[0].family + ', ' : '') +
            (refbib.author[0].given ? refbib.author[0].given : '')
        : '';
    },
    'getBooktitle': function(refbib) {
      return Array.isArray(refbib.title) && refbib.title.length > 0 ? refbib.title[0] : '';
    },
    'getType': function(refbib) {
      return refbib.type || '';
    },
    'getTitle': function(refbib) {
      return Array.isArray(refbib.title) && typeof refbib.title[0] !== 'undefined' ? refbib.title[0] : '';
    },
    'getPublisher': function(refbib) {
      return refbib.publisher || '';
    },
    'getPages': function(refbib) {
      return refbib.page || '';
    },
    'getMonth': function(refbib) {
      return typeof refbib.issued !== 'undefined' &&
        refbib.issued['date-parts'] &&
        Array.isArray(refbib.issued['date-parts']) &&
        Array.isArray(refbib.issued['date-parts'][0])
        ? refbib.issued['date-parts'][0][1]
        : '';
    },
    'getYear': function(refbib) {
      return typeof refbib.issued !== 'undefined' &&
        refbib.issued['date-parts'] &&
        Array.isArray(refbib.issued['date-parts']) &&
        Array.isArray(refbib.issued['date-parts'][0])
        ? refbib.issued['date-parts'][0][0]
        : '';
    },
    'getUrl': function(refbib) {
      return typeof refbib.link !== 'undefined' && Array.isArray(refbib.link) && typeof refbib.link[0] !== 'undefined'
        ? refbib.link[0].URL
        : '';
    },
    'getVolume': function(refbib) {
      return refbib.volume || '';
    }
  },
  // Build cite with Bibtex format
  'bibtex': function(refbib) {
    if (typeof refbib === 'undefined') return null;
    let author = CITE.data.getAuthor(refbib),
      booktitle = CITE.data.getBooktitle(refbib),
      month = CITE.data.getMonth(refbib),
      publisher = CITE.data.getPublisher(refbib),
      title = CITE.data.getTitle(refbib),
      type = CITE.data.getType(refbib),
      url = CITE.data.getUrl(refbib),
      pages = CITE.data.getPages(refbib),
      volume = CITE.data.getVolume(refbib),
      year = CITE.data.getYear(refbib),
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
  },
  'chicagoa': function(refbib) {
    // Nom de l’auteur, prénom de l’auteur ou nom de l’organisation. « Titre de l’article » Nom du volume de la revue, numéro (mois année de publication ) : étendue de la page de l’article. URL si applicable.
    if (typeof refbib === 'undefined') return null;
    let author = CITE.data.getAuthor(refbib),
      orgName = CITE.data.getOrgName(refbib),
      atitle = CITE.data.getATitle(refbib),
      revueName = CITE.data.getRevueName(refbib),
      month = CITE.data.getMonth(refbib),
      num = CITE.data.getNum(refbib),
      url = CITE.data.getUrl(refbib),
      pages = CITE.data.getPages(refbib),
      year = CITE.data.getYear(refbib),
      result = !author
        ? orgName
        : author +
          (author ? '. ' : '') +
          (atitle ? '« ' + atitle + ' » ' : '') +
          (revueName ? revueName + ', ' : '') +
          num +
          (year && month ? ' (' + year + '/' + month + ') : ' : '') +
          (pages ? pages + '. ' : '') +
          url;
    return result;
  },
  'chicagob': function(refbib) {
    // Nom de l’auteur, prénom de l’auteur ou nom de l’organisation. Année de publication. « Titre de l’article. » Nom du volume de revue, numéro (mois de publication ) : étendue de page de l’article. URL si applicable.
    if (typeof refbib === 'undefined') return null;
    let author = CITE.data.getAuthor(refbib),
      orgName = CITE.data.getOrgName(refbib),
      atitle = CITE.data.getATitle(refbib),
      revueName = CITE.data.getRevueName(refbib),
      month = CITE.data.getMonth(refbib),
      num = CITE.data.getNum(refbib),
      url = CITE.data.getUrl(refbib),
      pages = CITE.data.getPages(refbib),
      year = CITE.data.getYear(refbib),
      result = !author
        ? orgName
        : author +
          (author ? '. ' : '') +
          year +
          (year ? '. ' : '') +
          (atitle ? '« ' + atitle + ' » ' : '') +
          (revueName ? revueName + ', ' : '') +
          num +
          (year && month ? ' (' + year + '/' + month + ') : ' : '') +
          (pages ? pages + '. ' : '') +
          url;
    return result;
  },
  'apa': function(refbib) {
    // NomdefamilleAuteur, Initiales. et NomdefamilleAuteur, Initiale. (Année de publication). TitreArticle. TitreJournal, Volume (Numéro), Nombre de pages. https://doi.org/NuméroDOI
    if (typeof refbib === 'undefined') return null;
    let authors = CITE.data.getAuthors(refbib),
      orgName = CITE.data.getOrgName(refbib),
      atitle = CITE.data.getATitle(refbib),
      jtitle = CITE.data.getJTitle(refbib),
      revueName = CITE.data.getRevueName(refbib),
      num = CITE.data.getNum(refbib),
      url = CITE.data.getUrl(refbib),
      pages = CITE.data.getPages(refbib),
      year = CITE.data.getYear(refbib),
      result =
        authors +
        (year ? ' (' + year + '). ' : '. ') +
        atitle +
        (jtitle ? '. ' + jtitle : '') +
        (revueName ? ', ' + revueName : '') +
        (num ? ', (' + num + '), ' : '') +
        (pages ? pages + '. ' : '') +
        url;
    return result;
  }
};
