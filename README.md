#awslogs-stream

Stream to write logs to [AWS CloudWatch](http://aws.amazon.com/cloudwatch/).

This is actually a plain [Node.js Writable](https://nodejs.org/api/stream.html#stream_class_stream_writable) object stream.

##Usage

``` js
var bunyan = require('bunyan');
var CloudWatchStream = require('awslogs-stream');

var stream = CloudWatchStream({
  logGroupName: 'my-group',
  logStreamName: 'my-stream',
  cloudWatchLogsOptions: {
    region: 'us-west-1'
  },
  processLogRecord: function(record) {
    return {
      message: JSON.stringify(record),
      timestamp: 1*new Date(record.time)
    }
  }
});

var log = bunyan.createLogger({
  name: 'foo',
  streams: [
    {
      stream: stream,
      type: 'raw'
    }
  ]
});
```

##API

###CloudWatchStream(opts)
With `opts` of:

- `logGroupName` (required)
- `logStreamName` (required)
- `cloudWatchLogsOptions` (optional): options passed to the [`AWS.CloudWatchLogs`](http://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/CloudWatchLogs.html#constructor-property) constructor
- `cloudWatchLogs` (optional): optional existing cloudwatchlogs client
- `processLogRecord` (optional): function to process log records to for cloudwatch (it should return object with 2 properties: `message` to be string and `timestamp` to be unix timestamp)
- `bufferDuration` (optional, by default it is 5000 ms) timeout between writes
- `batchCount` (optional, by default 1000) after this number of records will be immediate send to cloud watch

On write of the first log, the module creates the logGroup and logStream if necessary.

We use the aws-sdk to write the logs - the AWS credentials have therefore to be configured using environment variables (`AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY`).


- [Configuring the aws-sdk](http://docs.aws.amazon.com/AWSJavaScriptSDK/guide/node-configuring.html)
- [`CloudWatchLogs.putLogEvents`](http://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/CloudWatchLogs.html#putLogEvents-property) is the method we use to write logs

##Contributors
This project was created by Mirko Kiefer ([@mirkokiefer](https://github.com/mirkokiefer)) and almost rewritten by Denis Bardadym.
