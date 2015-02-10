var longEmitter = require('../lib/manager.js');
var EventEmitter = require('events').EventEmitter;

exports['initializes correctly'] = function (test) {
	var manager = longEmitter();

	test.deepEqual(Object.keys(manager), ['create','get','close','finish','param','query', 'clear']);

	test.done();
	manager.clear(); //cleanup so our tests don't hang
};

exports['create bucket'] = function (test) {
	var manager = longEmitter();

	var a = manager.create();
	var id = a.id;

	test.ok(a);
	test.ok(id);

	var b = manager.get(id);

	test.strictEqual(a, b);

	test.done();
	manager.clear(); //cleanup so our tests don't hang
};

exports['close bucket'] = function (test) {
	var manager = longEmitter();

	var a = manager.create();
	var id = a.id;

	test.ok(a);
	test.ok(id);

	manager.close(id);

	test.ok(!manager.get(id));

	test.done();
	manager.clear(); //cleanup so our tests don't hang
};

exports['bucket cleanup'] = function (test) {
	var manager = longEmitter({
		expiration: 90,
		cleanupPeriod: 50
	});

	var a = manager.create();
	var id = a.id;

	test.ok(a);
	test.ok(id);

	setTimeout(function () {
		var b = manager.get(id);
		test.ok(!b, 'Bucket did not expire');
		test.done();
		manager.clear(); //cleanup so our tests don't hang
	}, 125);
};

exports['bucket finished'] = function (test) {
	var manager = longEmitter();

	var a = manager.create();
	var id = a.id;

	a.emit('one');

	manager.finish(id);
	
	a.emit('two');

	test.ok(manager.get(id), 'I lost mah bucket.');

	a.drain();

	a.once('_drained', function () {
		test.ok(!manager.get(id), 'Bucket still exists');

		test.done();

		manager.clear(); //cleanup so our tests don't hang
	});

};

exports['bucket released'] = function (test) {
	var manager = longEmitter();

	var a = manager.create();
	var id = a.id;

	a.emit('one');

	a.release();
	
	a.emit('two');

	test.ok(manager.get(id), 'I lost mah bucket.');

	a.drain();

	a.once('_drained', function () {
		test.ok(!manager.get(id), 'Bucket still exists');

		test.done();

		manager.clear(); //cleanup so our tests don't hang
	});
};

exports['bucket does not release until empty'] = function (test) {
	test.expect(5);
	var manager = longEmitter({maxSend: 5});

	var a = manager.create();
	var id = a.id;

	var i = 10;
	while (i--) a.emit('i');

	a.release();

	test.ok(manager.get(id), 'I lost mah bucket.');

	a.drain(function (events) {
		test.equal(events.length, 5);
	});

	test.ok(manager.get(id), 'I lost mah bucket.');

	a.drain(function (events) {
		test.equal(events.length, 5);
	});

	a.once('_drained', function () {
		test.ok(!manager.get(id), 'Bucket still exists');

		test.done();

		manager.clear(); //cleanup so our tests don't hang
	});
};

exports['param middleware'] = function (test) {
	var manager = longEmitter();

	var a = manager.create();

	a.emit('one');
	a.emit('two');
	a.emit('three');

	var res = {locals: {}};
	var req = new EventEmitter();

	manager.param(req, res, function (err) {
		test.ok(!err);
		test.deepEqual(res, {locals: {events: [['one'],['two'],['three']]}});
		test.done();

		manager.clear();
	}, a.id);
};

exports['param disconnect'] = function (test) {
	test.expect(1);
	var manager = longEmitter();

	var a = manager.create();

	var res = {locals: {}};
	var req = new EventEmitter();

	manager.param(req, res, function (err) {
		test.ok(false, 'Request should not have continued');
	}, a.id);

	setTimeout(function () {
		test.ok(req.emit('close'));

		manager.clear();
		test.done();
	}, 50);
};

exports['query middleware'] = function (test) {
	var manager = longEmitter({
		query: 'request'
	});

	var a = manager.create();

	a.emit('one');
	a.emit('two');
	a.emit('three');

	var req = new EventEmitter();
	req.query = {request: a.id};

	var res = {locals: {}};

	manager.query(req, res, function (err) {
		test.ok(!err);
		test.deepEqual(res, {locals: {events: [['one'],['two'],['three']]}});
		test.done();

		manager.clear();
	});
};


exports['query route'] = function (test) {
	var manager = longEmitter({
		query: function (req) {
			return req.query.request;
		},
		querySend: true
	});

	var a = manager.create();

	a.emit('one');
	a.emit('two');
	a.emit('three');

	var req = new EventEmitter();
	req.query = {request: a.id};

	var res = {locals: {}, json: function (body) {
		test.deepEqual(body, [['one'],['two'],['three']]);
		test.done();

		manager.clear();
	}};

	manager.query(req, res, function (err) {
		test.ok(false, 'Should not have called next()');
	});
};

exports['query disconnect'] = function (test) {
	test.expect(1);
	var manager = longEmitter({
		query: function (req) {
			return req.query.request;
		},
		querySend: true
	});

	var a = manager.create();

	var req = new EventEmitter();
	req.query = {request: a.id};

	var res = {locals: {}, json: function (body) {
		test.ok(false, 'Should not have called res.json()');
	}};

	manager.query(req, res, function (err) {
		test.ok(false, 'Request should not have continued');
	}, a.id);

	setTimeout(function () {
		test.ok(req.emit('close'));

		manager.clear();
		test.done();
	}, 50);
};

exports['multiple emitters'] = function (test) {
	test.expect(2);
	var manager = longEmitter();
	var a = manager.create();
	var b = manager.create();

	setTimeout(function () {
		a.emit('one');
	}, 10);

	setTimeout(function () {
		b.emit('two');
	}, 20);

	setTimeout(function () {
		b.emit('three');
		manager.finish(b.id);
	}, 30);

	setTimeout(function () {
		var b2 = manager.get(b.id);
		b2.drain(function (results) {
			test.deepEqual(results, [['two'], ['three']]);
		});
	}, 40);

	setTimeout(function () {
		a.emit('four');
		manager.finish(a);
	}, 50);

	setTimeout(function () {
		var a2 = manager.get(a.id);
		a2.drain(function (results) {
			test.deepEqual(results, [['one'], ['four']]);
			test.done();

			manager.clear();
		});
	}, 60);
};
