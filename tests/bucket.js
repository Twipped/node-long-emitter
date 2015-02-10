var Bucket = require('../lib/bucket.js');
var EventEmitter = require('events').EventEmitter;

exports['emits to queue'] = function (test) {
	var b = new Bucket();
	b.emit('testevent', 'arg1', 'argtwo');

	test.deepEqual(b._queue, [['testevent', 'arg1', 'argtwo']]);

	test.done();
};

exports['multiple emits to queue'] = function (test) {
	var b = new Bucket();
	b.emit('testevent', 'arg1', 'argtwo');
	b.emit('onemore', 2, {foo:'bar'});

	test.deepEqual(b._queue, [['testevent', 'arg1', 'argtwo'], ['onemore', 2, {foo:'bar'}]]);

	test.done();
};

exports['drains into callback'] = function (test) {
	var b = new Bucket();
	b.emit('testevent', 'arg1', 'argtwo');
	b.emit('onemore', 2, {foo:'bar'});

	b.drain(function (events) {
		test.deepEqual(events, [['testevent', 'arg1', 'argtwo'], ['onemore', 2, {foo:'bar'}]]);

		test.done();
	});
	
};

exports['drains into promise'] = function (test) {
	var b = new Bucket();
	b.emit('testevent', 'arg1', 'argtwo');
	b.emit('onemore', 2, {foo:'bar'});

	b.drain().then(function (events) {
		test.deepEqual(events, [['testevent', 'arg1', 'argtwo'], ['onemore', 2, {foo:'bar'}]]);

		test.done();
	});
	
};

exports['drain emits _drained'] = function (test) {
	var b = new Bucket();
	b.emit('one');
	b.emit('two');
	b.emit('three');

	var emitted = 0;

	b.once('_drained', function () {
		emitted++;
		test.strictEqual(emitted, 2);

		test.done();
	});

	b.drain(function () {
		emitted++;
		test.strictEqual(emitted, 1);

	});
};


exports['drains async'] = function (test) {
	var b = new Bucket();
	b.drain(function (events) {
		test.deepEqual(events, [['testevent', 'arg1', 'argtwo'], ['onemore', 2, {foo:'bar'}]]);

		test.done();
	});

	b.emit('testevent', 'arg1', 'argtwo');

	b.emit('onemore', 2, {foo:'bar'});
	
};

exports['drains async, with pause'] = function (test) {
	test.expect(2);

	var b = new Bucket({pause: 10, maxPause: 50});
	b.drain(function (events) {
		test.deepEqual(events, [['testevent', 'arg1', 'argtwo'], ['onemore', 2, {foo:'bar'}]]);

	});

	b.emit('testevent', 'arg1', 'argtwo');

	b.emit('onemore', 2, {foo:'bar'});

	setTimeout(function () {
		b.emit('three');

		b.drain(function (events) {
			test.deepEqual(events, [['three']]);
			test.done();
		});
	}, 100);
	
};

exports['drains async, with max wait'] = function (test) {
	test.expect(2);

	var b = new Bucket({pause: 100, maxPause: 500});

	b.drain(function (events) {
		test.deepEqual(events, [
			['iteration', 10],
			['iteration', 9],
			['iteration', 8],
			['iteration', 7],
			['iteration', 6],
			['iteration', 5]
		]);

	});

	var count = 10;
	function loop () {
		b.emit('iteration', count--);

		if (count > 0) setTimeout(loop, 90);
	}
	loop();

	setTimeout(function () {
		b.drain(function (events) {
			test.deepEqual(events, [
				['iteration', 4],
				['iteration', 3],
				['iteration', 2],
				['iteration', 1]
			]);
			test.done();
		});
	}, 1000);

	
};

exports['drains when maxEmits is reached'] = function (test) {
	test.expect(2);

	var b = new Bucket({pause: 150, maxPause: 500, maxEmits: 8});

	b.drain(function (events) {
		test.deepEqual(events, [
			['iteration', 10],
			['iteration', 9],
			['iteration', 8],
			['iteration', 7],
			['iteration', 6],
			['iteration', 5],
			['iteration', 4],
			['iteration', 3],
		]);
	});

	var count = 10;
	while (count > 0) {
		b.emit('iteration', count--);
	}

	b.drain(function (events) {
		test.deepEqual(events, [
			['iteration', 2],
			['iteration', 1],
		]);
		test.done();
	});
};

exports['drains when maxEmits is reached, async'] = function (test) {
	test.expect(2);

	var b = new Bucket({pause: 150, maxPause: 1000, maxEmits: 8});

	b.drain(function (events) {
		test.deepEqual(events, [
			['iteration', 10],
			['iteration', 9],
			['iteration', 8],
			['iteration', 7],
			['iteration', 6],
			['iteration', 5],
			['iteration', 4],
			['iteration', 3],
		]);
	});

	var count = 10;
	function loop () {
		b.emit('iteration', count--);

		if (count > 0) setTimeout(loop, 50);
	}
	loop();

	setTimeout(function () {
		b.drain(function (events) {
			test.deepEqual(events, [
				['iteration', 2],
				['iteration', 1],
			]);
			test.done();
		});
	}, 1000);
};

exports['drains up to maxSend'] = function (test) {
	test.expect(3);

	var b = new Bucket({maxSend: 10});

	b.drain(function (events) {
		test.strictEqual(events.length, 10);
	});

	var count = 25;
	while (count > 0) {
		b.emit('iteration', count--);
	}

	b.drain(function (events) {
		test.strictEqual(events.length, 10);
	});

	b.drain(function (events) {
		test.strictEqual(events.length, 5);
		test.done();
	});
};

exports['tapped into emitter'] = function (test) {
	test.expect(4);

	var b = new Bucket({pause: 10, maxPause: 50});

	b.emit('testevent', 'arg1', 'argtwo');

	b.emit('onemore', 2, {foo:'bar'});

	var emitter = new EventEmitter();
	emitter.on('testevent', function (arg1, arg2) {
		test.strictEqual(arg1, 'arg1');
		test.strictEqual(arg2, 'argtwo');
	});
	emitter.on('onemore', function (arg1, arg2) {
		test.strictEqual(arg1, 2);
		test.deepEqual(arg2, {foo: 'bar'});
	});
	emitter.on('three', function () {
		test.ok(false, 'should not have received third event');
	});

	emitter.on('_empty', test.done);
	
	b.tap(emitter);

	b.emit('three');
};

exports['tap error'] = function (test) {
	var b = new Bucket();
	b.emit('testevent', 'arg1', 'argtwo');

	test.throws(function () {
		b.tap(false);
	});

	test.done();
};

exports['drain timeout'] = function (test) {
	test.expect(2);
	var b = new Bucket({maxIdle: 500});
	var waited = false;

	setTimeout(function () {waited = true;}, 490);

	b.drain(function (events) {
		test.deepEqual(events, []);
		test.ok(waited, 'Did not wait');
		test.done();
	});
};

exports['drain abort'] = function (test) {
	test.expect(2);
	var b = new Bucket();

	var hook = b.drain(function (events) {
		test.ok(false, 'Still drained');
	});

	test.strictEqual(typeof hook, 'object');

	setTimeout(function () {
		hook.abort();

		b.emit('one');

		test.ok(true);
		test.done();
	}, 50);
};

exports['emit errors w/ listener'] = function (test) {
	test.expect(2);
	var b = new Bucket({maxIdle: 500});

	var e = new Error('Test error');

	b.on('error', function (err) {
		test.strictEqual(err, e);
	});

	b.drain(function (events) {
		test.deepEqual(events, [['one']]);
		test.done();
	});

	b.emit('error', e);
	b.emit('one');
};

exports['emit errors w/o listener'] = function (test) {
	test.expect(1);
	var b = new Bucket({maxIdle: 500});

	var e = new Error('Test error');

	b.drain(function (events) {
		test.deepEqual(events, [['error', e], ['one']]);
		test.done();
	});

	b.emit('error', e);
	b.emit('one');
};
