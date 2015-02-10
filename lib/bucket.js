var debounce = require('lodash.debounce');
var assign = require('lodash.assign');
var proxmis = require('proxmis');
var EventEmitter = require('events').EventEmitter;
var debug  = require('debug')('long-emitter:bucket');


function Bucket (options) {
	EventEmitter.call(this);

	options = assign({
		pause: 20,
		maxPause: 500,
		maxIdle: 1000 * 30,
		maxEmits: 0,
	}, options || {});

	this._queue = [];
	this._drains = [];
	this._options = options;

	this.sendNow = this.send;
	this.send = debounce(this.send, options.pause, {maxWait: options.maxPause});
	debug('created');
}

Bucket.prototype = Object.create(EventEmitter.prototype);

Bucket.prototype._emit = EventEmitter.prototype.emit;

Bucket.prototype.emit = function emit (name) {
	if (this._events[name] && this._emit.apply(this, arguments)) {
		debug('emitted to local', name);
		return true;
	}

	debug('emitted to queue', name);

	var evt = arrayFromArguments.apply(null, arguments);

	this._queue.push(evt);

	if (this._options.maxEmits && this._drains.length && this._queue.length >= this._options.maxEmits) {
		this.sendNow();
	} else {
		this.send();
	}

	return false;
};

Bucket.prototype.send = function send () {
	//no pending hooks.
	if (!this._drains.length) return;

	// nothing to send
	if (!this._queue.length) return;

	debug('send', this._queue.length);

	if (this._options.maxSend) {
		this._drains.shift()(this._queue.splice(0, this._options.maxSend));
		if (this._queue.length) {
			this.send(); //dispatch another send to drain the next batch
		} else {
			this._emit('_drained');
		}
	} else {
		this._drains.shift()(this._queue);
		this._queue = [];
		this._emit('_drained');
	}

	debug('emitted to local', '_drained');

	return this;
};

Bucket.prototype.drain = function drain (callback) {
	var p = proxmis({callback: callback, noError: true});
	var timer, that = this;

	debug('drain');

	var spigot = function (events) {
		// drain fired before the timer, clear the timer.
		if (timer) clearTimeout(timer);
		timer = null;

		debug('draining');

		// pass on the results
		p(events);

		debug('drained');
	};

	timer = setTimeout(function () {
		// Timeout fired before the drain occurred.
		timer = null;

		// Remove the drain listener
		var i = that._drains.indexOf(spigot);
		if (i > -1) that._drains.splice(i, 1);

		debug('drain timeout');
		// Call the proxmis function with an empty array.
		p([]);

		debug('drained empty');
	}, this._options.maxIdle);

	this._drains.push(spigot);
	this.send();

	p.abort = function () {
		if (timer) clearTimeout(timer);

		var i = that._drains.indexOf(spigot);
		if (i > -1) that._drains.splice(i, 1);

		debug('drain aborted');
	};

	return {
		then: p.then,
		catch: p.catch,
		abort: p.abort
	};
};

Bucket.prototype.tap = function tap (emitter) {
	if (!emitter || typeof emitter.emit === 'undefined') throw new TypeError('tap function expected to receive EventEmitter.');
	var pending = this._queue;
	this._queue = [];

	pending.forEach(function (evt) {
		emitter.emit.apply(emitter, evt);
	});

	emitter.emit('_empty');
	debug('emitted to external', '_empty');

	this._emit('_drained');
	debug('emitted to local', '_drained');

	return this;
};


module.exports = Bucket;


/**
* Helper function to convert arguments to an array without triggering de-optimization in V8
* MUST be called via .apply
* @private
* @return {Array<mixed>}
*/
function arrayFromArguments () {
	var len = arguments.length;
	var args = new Array(len);
	for(var i = 0; i < len; ++i) {
		args[i] = arguments[i];
	}
	return args;
}
