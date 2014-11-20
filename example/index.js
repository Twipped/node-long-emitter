
var express = require('express');
var app = express();

var longEmitter = require('../index.js')();

/**
 * Route to send the index.html frontend for our demo
 */
app.get('/', function (req, res) {
	res.sendFile(__dirname + '/index.html');
});

/**
 * This route is the public endpoint for receiving emitted data
 */
app.get('/emitter/:emitter', function (req, res) {
	var emitter = longEmitter.get(req.params.emitter);

	if (!emitter) {
		res.status(404).json({id: req.params.emitter, error: 'Emitter ID Not Found'});
		return;
	}

	// drain any events waiting to be sent
	var hook = emitter.drain(function (events) {
		// drain occured before the request closed, so we can remove our abort hook
		req.removeListener('close', hook.abort);
		
		// send all pending events
		res.json({id: emitter.id, events: events});
	});

	// if the request disconnects before completion, abort the drain.
	req.on('close', hook.abort);
});

/**
 * This route creates the emitter and redirects the user to it before kicking off whatever task will be emitting events
 */
app.get('/ticker/:count?', function (req, res) {
	var count = parseInt(req.params.length, 10) || 10; //count ten times if no length is defined

	// create our long-polling emitter that results will send to.
	var emitter = longEmitter.create();

	// the user wont be receiving any data from this request, so we can end it here.
	res.redirect(302, '/emitter/' + emitter.id);

	// call the function that performs whatever slow action we need to do, passing it the emitter to use.
	ticker(emitter, count);
});

/**
 * Our slow task. This will count down from `count` once every second until reaching 0.
 * @param  {[type]} emitter [description]
 * @param  {[type]} count   [description]
 * @return {[type]}         [description]
 */
function ticker(emitter, count) {
	if (count > 0) {
		// count is still positive. emit a tick and register a timeout for the next tick
		console.log('Tick', emitter.id, count);
		emitter.emit('tick', count);
		setTimeout(function () {
			ticker(emitter, count - 1);
		}, 1000);
	} else {
		// count is now 0, emit that the task is done and release (close) the emitter
		console.log('End', emitter.id);
		emitter.emit('end');
		emitter.release();
	}
}

app.listen(9000, function () {
	console.log('Server listening at http://localhost:9000/');
});