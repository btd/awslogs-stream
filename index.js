
var util = require('util');
var Writable = require('stream').Writable;
var AWS = require('aws-sdk');

module.exports = CloudWatchStream;

function CloudWatchStream(opts) {
  if(!(this instanceof CloudWatchStream)) return new CloudWatchStream(opts);

  Writable.call(this, { objectMode: true });

  this.logGroupName = opts.logGroupName;
  this.logStreamName = opts.logStreamName;

  this.bufferDuration = opts.bufferDuration || 5000; // ms
  this.batchCount = opts.batchCount || 1000; // number

  this.processLogRecord = opts.processLogRecord || function(record) { return record; };

  this.cloudwatch = opts.cloudWatchLogs || new AWS.CloudWatchLogs(opts.cloudWatchLogsOptions);

  this.queuedLogs = [];

  this.sequenceToken = null;
  this.writeQueued = false;
}

util.inherits(CloudWatchStream, Writable);

CloudWatchStream.prototype._write = function _write(record, _enc, cb) {
  this.queuedLogs.push(this.processLogRecord(record));

  var that = this;
  if(this.batchCount <= this.queuedLogs.length) {
    clearTimeout(this._timeout);
    this._writeLogs(function(err) {
      if(err) {
        that.emit('error', err);
      }
    });
  } else {
    this._scheduleWriteLogs();
  }
  cb();
};

CloudWatchStream.prototype._scheduleWriteLogs = function _scheduleWriteLogs() {
  var that = this;
  if (!this.writeQueued) {
    this.writeQueued = true;
    this._timeout = setTimeout(function() {
      that._writeLogs(function(err) {
        that.writeQueued = false;
        if(err) {
          that.emit('error', err);
        }
      });
    }, this.bufferDuration);
  }
};

CloudWatchStream.prototype._writeLogs = function _writeLogs(done) {
  var that = this;

  if (this.sequenceToken === null) {
    return getSequenceToken(this.cloudwatch, this.logGroupName, this.logStreamName, function(err, token) {
      if(err) return done(err);

      that.sequenceToken = token;
      that._writeLogs(done);
    });
  }
  var params = {
    logGroupName: this.logGroupName,
    logStreamName: this.logStreamName,
    sequenceToken: this.sequenceToken,
    logEvents: this.queuedLogs
  };

  this.queuedLogs = [];
  this.queuedCallbacks = [];

  makeRetryableCall(this.cloudwatch, 'putLogEvents', params, function(err, data) {
    if(err) {
      that.queuedLogs = params.logEvents.concat(that.queuedLogs);
      return done(err);
    }

    that.sequenceToken = data.nextSequenceToken;

    done();

    if (that.queuedLogs.length) {
      that._scheduleWriteLogs();
    }
  });
};

function getSequenceToken(cloudwatch, logGroupName, logStreamName, cb) {
  describeLogStreams(cloudwatch, logGroupName, logStreamName, function (err, data) {
    if (err) {
      if (err.name === 'ResourceNotFoundException') {
        return createLogGroupAndStream(cloudwatch, logGroupName, logStreamName, function(err) {
          cb(err);
        });
      }
      return cb(err);
    }
    if (data.logStreams.length === 0) {
      return createLogStream(cloudwatch, logGroupName, logStreamName, function(err) {
        cb(err);
      });
    }
    cb(null, data.logStreams[0].uploadSequenceToken);
  });
}

function createLogGroupAndStream(cloudwatch, logGroupName, logStreamName, cb) {
  createLogGroup(cloudwatch, logGroupName, function(err) {
    if(err) return cb(err);

    createLogStream(cloudwatch, logGroupName, logStreamName, cb);
  });
}

function makeRetryableCall(client, method, arg, callback) {
  client[method](arg, function(err, data) {
    if(err) {
      if(err.retryable) return makeRetryableCall(client, method, arg, callback);

      callback(err);
    } else {
      callback(null, data);
    }
  });
}

function createLogGroup(cloudwatch, logGroupName, cb) {
  makeRetryableCall(cloudwatch, 'createLogGroup', {
    logGroupName: logGroupName
  }, cb);
}

function createLogStream(cloudwatch, logGroupName, logStreamName, cb) {
  makeRetryableCall(cloudwatch, 'createLogStream', {
    logGroupName: logGroupName,
    logStreamName: logStreamName
  }, cb);
}

function describeLogStreams(cloudwatch, logGroupName, logStreamName, cb) {
  makeRetryableCall(cloudwatch, 'describeLogStreams', {
    logGroupName: logGroupName,
    logStreamNamePrefix: logStreamName
  }, cb);
}
