void function () {
	'use strict';

	var http = require('http');
	var url  = require('url');
	var net  = require('net');
	var log = require('log-manager').getLogger();
	log.setLevel('debug');
	var configs = require('./http-proxy-configs.json');
	var excludes = configs.excludes || [];
	log.info(excludes);
	excludes = excludes.map(s => new RegExp(s
		.replace(new RegExp('\\.', 'g'), '\\.')
		.replace(new RegExp('\\*', 'g'), '.*') +
		':.*'));
	log.info(excludes);

	var HTTP_PORT = process.argv[2] || process.env.PORT || 8080;
	var PROXY_URL = process.argv[3] || null;

	var PROXY_HOST = PROXY_URL ?  url.parse(PROXY_URL).hostname    : null;
	var PROXY_PORT = PROXY_URL ? (url.parse(PROXY_URL).port || 80) : null;

	var connCount = 0;

	function printError(err, msg, url) {
		log.warn('%s: %s %s', msg, err, url);
	}

	var cluster = require('cluster');
	var numWorkers = 1; //require('os').cpus().length;
	if (numWorkers > 1 && cluster.isMaster) {
		// master
		log.info('numWorkers: ' + numWorkers);
		for (var i = 0; i < numWorkers; i++)
			cluster.fork();
		cluster.on('death', function onDeath(worker) {
			log.info('worker ' + worker.pid + ' died');
		});
		return;
	}

	var server = http.createServer(function onCliReq(cliReq, cliRes) {
		var x = url.parse(cliReq.url);
		log.trace('http  : (%d) %s%s', connCount,
			x.hostname + ':' + (x.port || 80));
		if (PROXY_URL)
			var options = {host: PROXY_HOST, port: PROXY_PORT, path: cliReq.url,
				method: cliReq.method, headers: cliReq.headers};
		else
			var options = {host: x.hostname, port: x.port || 80, path: x.path,
				method: cliReq.method, headers: cliReq.headers};
		var svrReq = http.request(options, function onSvrRes(svrRes) {
			cliRes.writeHead(svrRes.statusCode, svrRes.headers);
			svrRes.pipe(cliRes);
		});
		cliReq.pipe(svrReq);
		svrReq.on('error', function onSvrReqErr(err) {
			cliRes.writeHead(400, err.message, {'content-type': 'text/html'});
			cliRes.end('<h1>' + err.message + '<br/>' + cliReq.url + '</h1>');
			printError(err, 'svrReq', x.hostname + ':' + (x.port || 80));
		});
	}).listen(HTTP_PORT);

	server.on('clientError', function onCliErr(err, c) {
		c.end();
		printError(err, 'cliErr', '');
	});

	server.on('connect', function onCliConn(cliReq, c, cliHead) {
		for (var i = 0; i < excludes.length; ++i)
			if (cliReq.url.match(excludes[i]))
				return log.debug('https discon!', cliReq.url), c.destroy();
			//console.log(cliReq.url.match(excludes[i]), excludes[i], cliReq.url);
		var x = url.parse('https://' + cliReq.url);
		log.trace('https : (%d) %s%s', connCount, cliReq.url);
		if (PROXY_HOST) {
			var options = {host: PROXY_HOST, port: PROXY_PORT, path: cliReq.url,
				method: cliReq.method, headers: cliReq.headers};
			var svrReq = http.request(options);
			svrReq.end();
			var s = null;
			svrReq.on('connect', function onSvrConn(svrRes, svrSoc2, svrHead) {
				s = svrSoc2;
				c.write('HTTP/1.0 200 Connection established\r\n\r\n');
				if (cliHead && cliHead.length) s.write(cliHead);
				if (svrHead && svrHead.length) c.write(svrHead);
				s.pipe(c);
				c.pipe(s);
				s.on('error', funcOnSocErr(c, 'svrSoc', cliReq.url));
			});
			svrReq.on('error', funcOnSocErr(c, 'svrRq2', cliReq.url));
		}
		else {
			var s = net.connect(x.port || 443, x.hostname, function onSvrConn() {
				c.write('HTTP/1.0 200 Connection established\r\n\r\n');
				if (cliHead && cliHead.length) s.write(cliHead);
				c.pipe(s);
			});
			s.pipe(c);
			s.on('error', funcOnSocErr(c, 'svrSoc', cliReq.url));
		}
		c.on('error', function onCliSocErr(err) {
			if (s) s.end();
			printError(err, 'cliSoc', cliReq.url);
		});
		function funcOnSocErr(soc, msg, url) {
			return function onSocErr(err) {
				soc.end();
				printError(err, msg, url);
			};
		}
	});

	log.info('http proxy server started on port ' + HTTP_PORT +
		(PROXY_URL ? ' -> ' + PROXY_HOST + ':' + PROXY_PORT : ''));

	var whiteAddressList = {};
	whiteAddressList['127.0.0.1'] = true;
	whiteAddressList['192.168.251.1'] = true;

	server.on('connection', function onConn(c) {
		var remoteAddress = c.remoteAddress;
		if (remoteAddress.startsWith('::ffff:'))
			remoteAddress = remoteAddress.substr(7);
		if (remoteAddress in whiteAddressList) return;
		log.warn('reject: ', c.remoteAddress);
		c.destroy();
	});

	server.on('connection', function onConn(c) {
		var connTime = new Date();
		log.trace('++conn: (%d) from: %s', ++connCount,
		c.remoteAddress);
		c.on('close', function onDisconn() {
			log.trace('--conn: (%d) time: %s sec', --connCount,
				(new Date() - connTime) / 1000.0);
		});
	});

}();
