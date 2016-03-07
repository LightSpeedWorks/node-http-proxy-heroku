void function () {
	'use strict';

	var io = require('socket.io-client');
	var log = require('log-manager').getLogger();
	log.setLevel(process.env.APP_LOG_LEVEL || 'trace');
	log.info('logLevel:', process.env.APP_LOG_LEVEL || 'trace');

	var targetUrl = process.argv[2] || 'http://localhost:8000';

	// time 時刻
	var tm = () => new Date().toLocaleTimeString();
	var time = 500;

	var socket = io(targetUrl);
	socket.on('news', function (msg) {
		log.trace('news', msg);
		msg = {my:'other', tm:tm()};
		log.trace('other', msg);
		socket.emit('my other event', msg);
	});
	socket.on('disconnect', function () {
		log.trace('disconnect!');
	});
	setTimeout(function timer() {
		time *= 2;
		if (time >= 60000) time = 60000;
		setTimeout(timer, time);

		var msg = {my:'timer', tm:tm(), bf:new Buffer('abc')};
		log.trace('timer', msg);
		socket.emit('my timer event', msg);
	}, time);
}();
