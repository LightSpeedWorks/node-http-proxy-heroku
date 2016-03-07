void function () {
	'use strict';

	var app = require('http').createServer(handler)
	var io = require('socket.io')(app);
	var fs = require('fs');
	var path = require('path');
	var log = require('log-manager').getLogger();
	log.setLevel(process.env.APP_LOG_LEVEL || 'trace');
	log.info('logLevel:', process.env.APP_LOG_LEVEL || 'trace');

	// port number ポート番号
	var port = process.argv[2] || process.env.PORT || 80;

	// time 時刻
	var tm = () => new Date().toLocaleTimeString();
	var mimes = {
		'.html':'text/html; charset=utf-8',
		'.js':'application/x-javascript; charset=utf-8'
	};

	app.on('error', err =>
		log.fatal('server error:', err));
	app.listen(port, () =>
		log.info('server started: port', port));

	function handler(req, res) {
		log.debug(req.method, req.url);
		var file = req.url === '/' ? '/app1.html' : req.url;
		fs.readFile(__dirname + file,
		function (err, data) {
			if (err) {
				log.warn('error reading:', file, err);
				res.writeHead(500);
				return res.end('Error loading ' + file);
			}

			res.writeHead(200, {'content-type':
					mimes[path.extname(file)] ||
					'text/plain; charset=utf-8'});
			res.end(data);
		});
	}

	io.on('connection', function (socket) {
		var msg = {hello:'world', 'こんにちは':'世界', tm:tm()};
		log.trace('news:', msg);
		socket.emit('news', msg);
		socket.on('my other event', function (msg) {
			log.trace('other:', msg);
		});
		socket.on('my timer event', function (msg) {
			log.trace('timer:', msg);
		});
		socket.on('disconnect', function () {
			log.trace('disconnect!');
		});
	});

}();
