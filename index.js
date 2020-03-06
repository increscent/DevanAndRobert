const server = require('./server.js');
const config = require('./config.js');

let app = server({
    port: config.server.port,
    staticDirs: ['./public'],
    notFoundPage: './public/404.html'
});

app.post('/rsvp/submit', (req, res) => {
    console.log(req.body);
    res.sendFile('./public/rsvp.html');
});
