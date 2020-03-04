const server = require('./server.js');
const config = require('./config.js');

server({port: config.server.port, staticDirs: ['./public']});
