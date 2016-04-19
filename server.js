var express = require('express');
var serveStatic = require('serve-static');
var i2c = require('i2c-bus'), bus = i2c.openSync(1);

var i2cTransaction = function (req, res) {
    var resObject = {'result': false};
    if (req.params.sid) {
	try {
	    var sid = parseInt(req.params.sid);
	    if (req.params.prot == 'wb' && req.query.data) {
		var data = parseInt(req.query.data);
		bus.sendByteSync(sid, data);
		resObject['result'] = true;
	    }
	    else if (req.params.prot == 'rb') {
		var data = bus.receiveByteSync(sid, data);
		resObject['result'] = true;
		resObject['value'] = data;
	    }
	    else if (req.params.prot == 'wd' && req.query.reg && req.query.data) {
		var reg = parseInt(req.query.reg);
		var data = parseInt(req.query.data);
		bus.writeByteSync(sid, reg, data);
		resObject['result'] = true
	    }
	    else if (req.params.prot == 'rd' && req.query.reg) {
		var reg = parseInt(req.query.reg);
		var data = bus.readByteSync(sid, reg);
		resObject['result'] = true;
		resObject['value'] = data;
	    }
	}
	catch (err) {}
    }
    res.send(JSON.stringify(resObject));
}

var app = express();

app.use(serveStatic('invar'));
app.use(serveStatic('node_modules/codemirror'));
app.get('/i2c/:prot/:sid/', i2cTransaction);

if (process.getuid() == 0) {
    app.listen(80);
}
else {
    app.listen(8080);
}
