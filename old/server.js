var app, server,
    express = require('express'),
    path = require('path'),
    host = '0.0.0.0',
    port = 5678,
    root = path.resolve(__dirname);
    
    console.log(root)
 
app = express();
app.use(function(req, res, next) { console.log(req.url); next(); });
app.use(express.static(root));
server = app.listen(port, host, serverStarted);
 
function serverStarted () {
    console.log('Server started', host, port);
    console.log('Root directory', root);
    console.log('Press Ctrl+C to exit...\n');
}