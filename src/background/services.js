/*
 * @prettier
 */
'use strict';

const SERVICES = {};

// download file with method GET
SERVICES.FILE = {
  'get': function(options, cb) {
    let opts = Object.assign(
      {
        'method': 'GET',
        'xhrFields': {
          'responseType': 'blob'
        },
        'timeout': 16000,
        'tryCount': 0,
        'maxRetry': 1
      },
      options
    );
    return $.ajax(opts)
      .done(function(res) {
        return cb(false, res);
      })
      .fail(function(jqXHR, textStatus, errorThrown) {
        if (textStatus === 'timeout' && this.tryCount < this.maxRetry) {
          this.tryCount++;
          return $.ajax(this);
        } else
          return cb(true, {
            'status': jqXHR.status,
            'errorThrown': errorThrown,
            'textStatus': textStatus,
            'url': this.url
          });
      });
  }
};

// call GROBID services
SERVICES.GROBID = {
  'call': function(options, cb) {
    let opts = Object.assign(
      {
        'method': 'POST',
        'timeout': 16000,
        'tryCount': 0,
        'maxRetry': 1
      },
      options
    );
    return $.ajax(opts)
      .done(function(res) {
        return cb(false, res);
      })
      .fail(function(jqXHR, textStatus, errorThrown) {
        if (textStatus === 'timeout' && this.tryCount < this.maxRetry) {
          this.tryCount++;
          $.ajax(this);
        } else
          return cb(true, {
            'status': jqXHR.status,
            'errorThrown': errorThrown,
            'textStatus': textStatus,
            'url': this.url
          });
      });
  },
  'processCitation': function(options, cb) {
    return SERVICES.GROBID.call(
      {
        'url': options.url,
        'dataType': 'xml',
        'data': options.data
      },
      function(err, res) {
        if (err) return cb(err, res);
        else return cb(err, extractParams(res));
      }
    );
  },
  'referenceAnnotations': function(options, cb) {
    let formData = new FormData();
    formData.append('input', options.input);
    return SERVICES.GROBID.call(
      {
        'url': options.url,
        'dataType': 'json',
        'data': formData,
        'cache': false,
        'contentType': false,
        'processData': false
      },
      function(err, res) {
        return cb(err, res);
      }
    );
  },
  'processHeaderDocument': function(options, cb) {
    let formData = new FormData();
    formData.append('input', options.input);
    return SERVICES.GROBID.call(
      {
        'url': options.url,
        'dataType': 'xml',
        'data': formData,
        'cache': false,
        'contentType': false,
        'processData': false
      },
      function(err, res) {
        if (err) return cb(err, res);
        else return cb(err, extractParams(res));
      }
    );
  }
};

SERVICES.GLUTTON = {
  'call': function(options, cb) {
    let opts = Object.assign(
      {
        'timeout': 16000,
        'tryCount': 0,
        'maxRetry': 1
      },
      options
    );
    return $.ajax(opts)
      .done(function(data) {
        return cb(false, data);
      })
      .fail(function(jqXHR, textStatus, errorThrown) {
        if (textStatus === 'timeout' && this.tryCount < this.maxRetry) {
          this.tryCount++;
          return $.ajax(this);
        } else
          return cb(true, {
            'status': jqXHR.status,
            'errorThrown': errorThrown,
            'textStatus': textStatus,
            'url': this.url
          });
      });
  },
  'get': function(options, cb) {
    return SERVICES.GLUTTON.call({ 'url': options.url, 'method': 'GET' }, function(err, res) {
      return cb(err, res);
    });
  }
};

// Extract data from GROBID response
function extractParams(element) {
  let root = $(element);
  return {
    'postValidate': 'true',
    'firstAuthor': root.find('author:first surname').text() || undefined, // firstAuthor
    'atitle': root.find('analytic title[level="a"]').text() || undefined, // atitle
    'jtitle': root.find('monogr title[level="j"]').text() || undefined, // jtitle
    'volume': root.find('biblscope[unit="volume"]').text() || undefined, // volume
    'firstPage': root.find('biblscope[unit="page"]').attr('from') || undefined, // firstPage
    'doi': root.find('idno[type="DOI"]').text() || undefined, // doi
    'pmid': root.find('idno[type="PMID"]').text() || undefined, // pmid
    'pmc': root.find('idno[type="pmc"]').text() || undefined, // pmc
    'istexId': root.find('idno[type="istexId"]').text() || undefined // istexid
  };
}
