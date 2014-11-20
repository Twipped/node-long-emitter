Node.js Long-Emitter
===

A buffered event emitter designed for use in simple long-polling event streaming from Node.js servers to web site front-ends, and managing delayed responses & timeouts.

[![NPM version](https://img.shields.io/npm/v/long-emitter.svg)](http://npmjs.org/long-emitter)
[![Licensed MIT](https://img.shields.io/npm/l/long-emitter.svg)](https://github.com/ChiperSoft/node-long-emitter/blob/master/LICENSE.txt)
[![Nodejs 0.10+](https://img.shields.io/badge/node.js-%3E=_0.10-brightgreen.svg)](http://nodejs.org)
[![Downloads](http://img.shields.io/npm/dm/long-emitter.svg)](http://npmjs.org/long-emitter)
[![Build Status](https://img.shields.io/travis/ChiperSoft/node-long-emitter.svg)](https://travis-ci.org/ChiperSoft/node-long-emitter)
[![Coverage Status](https://img.shields.io/coveralls/ChiperSoft/node-long-emitter.svg)](https://coveralls.io/r/ChiperSoft/node-long-emitter)
[![Gittip](http://img.shields.io/gittip/chipersoft.svg)](https://www.gittip.com/chipersoft/)

#Installation

NPM: `npm install long-emitter`

##Example

See the [example application](https://github.com/ChiperSoft/node-long-emitter/tree/master/example) for a basic use case.

##Basic Usage

```js
var longEmitter = require('long-emitter');
var manager = longEmitter();
var emitter = manager.create();
emitter.emit('a');
emitter.emit('b', 2);
emitter.drain(function (events) {
	// events -> [ ['a'], ['b', 2], ['c', 'hello'] ]
});
emitter.emit('c', 'hello');
emitter.release();
```

##Usage

Documentation to be written.