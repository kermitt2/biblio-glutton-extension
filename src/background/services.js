/*
 * @prettier
 */
'use strict';

const SERVICES = {};

// download file with method GET
SERVICES.FILE = {
  'getPDF': function(options, cb) {
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
      .done(function(res, textStatus, jqXHR) {
        let ct = jqXHR.getResponseHeader('content-type') || '';
        if (ct.indexOf('pdf') === -1)
          return cb(true, {
            'status': jqXHR.status,
            'errorThrown': "Content Type of response don't match with content type of PDF",
            'textStatus': textStatus,
            'url': this.url
          });
        return cb(false, { 'blob': res, 'data': URL.createObjectURL(res) });
      })
      .fail(function(jqXHR, textStatus, errorThrown) {
        if (textStatus === 'timeout' && opts.tryCount < opts.maxRetry) {
          opts.tryCount++;
          SERVICES.FILE.getPDF(opts, cb);
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
        if (textStatus === 'timeout' && opts.tryCount < opts.maxRetry) {
          opts.tryCount++;
          SERVICES.GROBID.call(opts, cb);
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
        return cb(err, res);
      }
    );
  },
  'referenceAnnotations': function(options, cb) {
    let formData = new FormData();
    formData.append('input', options.input);
    formData.append('consolidateCitations', 1);
    return SERVICES.GROBID.call(
      {
        'timeout': 30000,
        'url': options.url,
        'dataType': 'json',
        'data': formData,
        'cache': false,
        'contentType': false,
        'processData': false
      },
      function(err, res) {
        let json = JSON.stringify(res),
          blob = new Blob([json], { type: 'application/json' }),
          url = URL.createObjectURL(blob);
        return cb(err, { 'data': res, 'url': url });
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
        return cb(err, res);
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
        if (textStatus === 'timeout' && opts.tryCount < opts.maxRetry) {
          opts.tryCount++;
          SERVICES.GLUTTON.call(opts, cb);
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
