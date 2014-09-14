var crypto = require('crypto');
var Bucket = require('./bucket.js');
var assign = require('lodash.assign');

module.exports = function (options) {
	options = assign({
		querySend: false,
		query: 'streamid',
		pause: 100,
		maxPause: 500,
		expiration: 1000 * 60 * 5, // five minutes
		cleanupPeriod: 1000 * 30   // every 30 seconds
	}, options || {});

	var buckets = {};
	var bucketCount = 0;
	var timeout;

	function get (id) {
		if (buckets[id]) {
			//reset expiration time
			buckets[id].expires = Date.now() + options.expiration;
		}
		return buckets[id];
	}

	function close (id) {
		var bucket = buckets[id];
		if (!bucket) return server;

		bucket.removeAllListeners();
		delete buckets[id];

		bucketCount--;
		if (!bucketCount && timeout) {
			// nothing left to clean up
			clearTimeout(timeout);
			timeout = null;
		}

		return server;
	}

	function finish (id) {
		var bucket = buckets[id];
		if (!bucket) return server;
		
		bucket.once('_drained', function () {
			close(id);
		});
	}

	function create () {
		var id = crypto.randomBytes(32).toString('hex');

		var emitter = new Bucket(options);
		emitter.id = id;
		emitter.expires = Date.now() + options.expiration;

		buckets[id] = emitter;
		bucketCount++;

		// click off the expiration checker
		cleanup();
		return emitter;
	}

	function cleanup () {
		// check if there are existing buckets and no cleanup already pending
		if (!bucketCount || timeout) return;

		timeout = setTimeout(function () {
			timeout = null;

			var ids = Object.keys(buckets);
			var now = Date.now();

			// loop through all buckets and remove those which have expired
			ids.forEach(function (id) {
				if (buckets[id].expires < now) {
					close(id);
				}
			});

			cleanup();
		}, options.cleanupPeriod);

		return server;
	}

	function clear () {
		if (timeout) {
			clearTimeout(timeout);
			timeout = null;
		}

		buckets = {};
		bucketCount = 0;

		return server;
	}

	function param (req, res, next, id) {
		var emitter = get(id);

		if (!emitter) return next();

		emitter.drain(function (events) {
			res.locals.events = events;
			next();
		});
	}

	function query (req, res, next) {
		var id;
		if (typeof options.query === 'string') {
			id = req.query[options.query];
		} else if (typeof options.query === 'function') {
			id = options.query(req);
		}

		var emitter = get(id);

		if (!emitter) {
			if (options.querySend) {
				return next('route');
			} else {
				return next();
			}
		}

		
		emitter.drain(function (events) {
			if (options.querySend) {
				res.json(events);
			} else {
				res.locals.events = events;
				next();
			}
		});

	}

	var server = {
		create: create,
		get: get,
		close: close,
		finish: finish,
		param: param,
		query: query,
		clear: clear
	};

	return server;
};

module.exports.Bucket = Bucket;