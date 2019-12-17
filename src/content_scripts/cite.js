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
      booktitle = refbib.title[0] || '',
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
  },
  'chicagoa': function(refbib) {
    // Nom de l’auteur, prénom de l’auteur ou nom de l’organisation. « Titre de l’article » Nom du volume de la revue, numéro (mois année de publication ) : étendue de la page de l’article. URL si applicable.
    if (typeof refbib === 'undefined' || typeof refbib.publisher === 'undefined') return null;
    let author =
        typeof refbib.author !== 'undefined' && refbib.author.length > 0
          ? refbib.author[0].family + ',' + refbib.author[0].given
          : '',
      orgName = refbib.orgName,
      atitle = refbib.processCitation.atitle.text || '',
      revueName = refbib.processCitation.mtitle.text || '',
      month =
        typeof refbib.issued !== 'undefined' && typeof refbib.issued['date-parts'] !== 'undefined'
          ? refbib.issued['date-parts'][0][1]
          : '',
      num = refbib.issue,
      url = typeof refbib.link !== 'undefined' && refbib.link.length > 0 ? refbib.link[0].URL : '',
      pages = refbib.page || '',
      year =
        typeof refbib.issued !== 'undefined' && refbib.issued['date-parts'] && refbib.issued['date-parts'].length > 0
          ? refbib.issued['date-parts'][0][0]
          : '',
      result = !author
        ? orgName
        : author +
          '. « ' +
          atitle +
          ' » ' +
          revueName +
          ', ' +
          num +
          ' (' +
          year +
          '/' +
          month +
          ') : ' +
          pages +
          '. ' +
          url;
    return result;
  },
  'chicagob': function(refbib) {
    // Nom de l’auteur, prénom de l’auteur ou nom de l’organisation. Année de publication. « Titre de l’article. » Nom du volume de revue, numéro (mois de publication ) : étendue de page de l’article. URL si applicable.
    if (typeof refbib === 'undefined' || typeof refbib.publisher === 'undefined') return null;
    let author =
        typeof refbib.author !== 'undefined' && refbib.author.length > 0
          ? refbib.author[0].family + ',' + refbib.author[0].given
          : '',
      orgName = refbib.orgName,
      atitle = refbib.processCitation.atitle.text || '',
      revueName = refbib.processCitation.mtitle.text || '',
      month =
        typeof refbib.issued !== 'undefined' && typeof refbib.issued['date-parts'] !== 'undefined'
          ? refbib.issued['date-parts'][0][1]
          : '',
      num = refbib.issue,
      url = typeof refbib.link !== 'undefined' && refbib.link.length > 0 ? refbib.link[0].URL : '',
      pages = refbib.page || '',
      year =
        typeof refbib.issued !== 'undefined' && refbib.issued['date-parts'] && refbib.issued['date-parts'].length > 0
          ? refbib.issued['date-parts'][0][0]
          : '',
      result = !author
        ? orgName
        : author +
          '. ' +
          year +
          '.« ' +
          atitle +
          ' » ' +
          revueName +
          ', ' +
          num +
          ' (' +
          year +
          '/' +
          month +
          ') : ' +
          pages +
          '. ' +
          url;
    return result;
  },
  'apa': function(refbib) {
    // NomdefamilleAuteur, Initiales. et NomdefamilleAuteur, Initiale. (Année de publication). TitreArticle. TitreJournal, Volume (Numéro), Nombre de pages. https://doi.org/NuméroDOI
    if (typeof refbib === 'undefined' || typeof refbib.publisher === 'undefined') return null;
    let authors =
        typeof refbib.author !== 'undefined' && refbib.author.length > 0
          ? refbib.author.map(function(author) {
              return author.family + ',' + author.given + '. ';
            })
          : '',
      orgName = refbib.orgName,
      atitle = refbib.processCitation.atitle.text || '',
      jtitle = refbib.processCitation.jtitle.text || '',
      revueName = refbib.processCitation.mtitle.text || '',
      num = refbib.issue,
      url = typeof refbib.link !== 'undefined' && refbib.link.length > 0 ? refbib.link[0].URL : '',
      pages = refbib.page || '',
      year =
        typeof refbib.issued !== 'undefined' && refbib.issued['date-parts'] && refbib.issued['date-parts'].length > 0
          ? refbib.issued['date-parts'][0][0]
          : '',
      result =
        authors +
        ' (' +
        year +
        '). ' +
        atitle +
        '. ' +
        jtitle +
        ', ' +
        revueName +
        ', (' +
        num +
        '), ' +
        pages +
        '. ' +
        url;
    return result;
  }
};
