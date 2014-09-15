var longEmitter = require('../lib/server.js');

exports['initializes correctly'] = function (test) {
	var server = longEmitter();

	test.deepEqual(Object.keys(server), ['create','get','close','finish','param','query', 'clear']);

	test.done();
	server.clear(); //cleanup so our tests don't hang
};

exports['create bucket'] = function (test) {
	var server = longEmitter();

	var a = server.create();
	var id = a.id;

	test.ok(a);
	test.ok(id);

	var b = server.get(id);

	test.strictEqual(a, b);

	test.done();
	server.clear(); //cleanup so our tests don't hang
};

exports['close bucket'] = function (test) {
	var server = longEmitter();

	var a = server.create();
	var id = a.id;

	test.ok(a);
	test.ok(id);

	server.close(id);

	test.ok(!server.get(id));

	test.done();
	server.clear(); //cleanup so our tests don't hang
};

exports['bucket cleanup'] = function (test) {
	var server = longEmitter({
		expiration: 90,
		cleanupPeriod: 50
	});

	var a = server.create();
	var id = a.id;

	test.ok(a);
	test.ok(id);

	setTimeout(function () {
		var b = server.get(id);
		test.ok(!b, 'Bucket did not expire');
		test.done();
		server.clear(); //cleanup so our tests don't hang
	}, 125);
};

exports['bucket finished'] = function (test) {
	var server = longEmitter();

	var a = server.create();
	var id = a.id;

	a.emit('one');

	server.finish(id);
	
	a.emit('two');

	test.ok(server.get(id), 'I lost mah bucket.');

	a.drain();

	a.once('_drained', function () {
		test.ok(!server.get(id), 'Bucket still exists');

		test.done();

		server.clear(); //cleanup so our tests don't hang
	});

};

exports['param middleware'] = function (test) {
	var server = longEmitter();

	var a = server.create();

	a.emit('one');
	a.emit('two');
	a.emit('three');

	var res = {locals: {}};

	server.param({}, res, function (err) {
		test.ok(!err);
		test.deepEqual(res, {locals: {events: [['one'],['two'],['three']]}});
		test.done();

		server.clear();
	}, a.id);
};

exports['query middleware'] = function (test) {
	var server = longEmitter({
		query: 'request'
	});

	var a = server.create();

	a.emit('one');
	a.emit('two');
	a.emit('three');

	var req = {query: {request: a.id}};
	var res = {locals: {}};

	server.query(req, res, function (err) {
		test.ok(!err);
		test.deepEqual(res, {locals: {events: [['one'],['two'],['three']]}});
		test.done();

		server.clear();
	});
};


exports['query route'] = function (test) {
	var server = longEmitter({
		query: function (req) {
			return req.query.request;
		},
		querySend: true
	});

	var a = server.create();

	a.emit('one');
	a.emit('two');
	a.emit('three');

	var req = {query: {request: a.id}};
	var res = {locals: {}, json: function (body) {
		test.deepEqual(body, [['one'],['two'],['three']]);
		test.done();

		server.clear();
	}};

	server.query(req, res, function (err) {
		test.ok(false, 'Should not have called next()');
	});
};