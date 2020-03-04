const http = require('http');
const fs = require('fs');
const path = require('path');

const hostname = '127.0.0.1';
const port = 4445;

module.exports = ({port, hostname, staticDirs}) => {
    port = port || 80;
    hostname = hostname || '127.0.0.1';
    staticDirs = staticDirs || [];

    let handlers = {
    };

    const server = http.createServer((req, res) => {
        let [url, queryStr] = req.url.split('?', 2);

        req.query = {};
        if (queryStr) queryStr
            .split('&')
            .map(x => x.split('='))
            .map(x => x.map(y => decodeURIComponent(y)))
            .map(([x, y]) => req.query[x] = y);

        let pathParts = url
            .replace(/\.\./g, '')
            .split('/')
            .filter(x => x);

        req.path = pathParts.join('/');

        res.send = (data, statusCode, contentType) => {
            res.statusCode = statusCode || 200;
            res.setHeader('Content-Type', contentType || 'text/plain');
            res.end(data);
        };

        res.sendJson = (json, statusCode) => {
            json = (typeof(json) == 'string') ? json : JSON.stringify(json)

            res.send(json, statusCode, 'application/json');
        }

        let body = [];
        req.on('data', (chunk) => body.push(chunk));
        req.on('end', () => {
            let bodyStr = Buffer.concat(body).toString();

            req.body = (req.headers['content-type'] == 'application/json') ?
                JSON.parse(bodyStr) : bodyStr;

            let matchPath = (targetPath) => {
                let targetPathParts = targetPath.split('/');

                return pathParts.map((x, i) => [x, targetPathParts[i]])
                    .reduce((acc, [x, y]) => (x == y) && acc, true);
            };

            let handler = (handlers[req.method] || []).find((x) => matchPath(x.path));

            if (handler) return handler.handler(req, res);

            // try static files only for GET
            if (req.method != 'GET') return res.send('Not found', 404);

            tryList = [
                `${req.path}`,
                `${req.path}/index.html`,
                `${req.path}.html`,
            ];

            let tryStatic = (dirs) => {
                if (dirs.length == 0) return res.send('Not found', 404);

                let dirParts = dirs.shift().split('/').filter(x => x);

                let dir1 = dirParts.concat(pathParts.slice(0, pathParts.length-1)).join('/');

                fs.readdir(dir1, (err, files) => {
                    if (!err) {
                        let lastPart = pathParts[pathParts.length-1];
                        let file = files.find(x => x == lastPart || x == `${lastPart}.html`);

                        if (file) return serveStatic(res, dir1+'/'+file);
                    }

                    let dir2 = dirParts.concat(pathParts).join('/');

                    fs.readdir(dir2, (err, files) => {
                        if (!err && files.includes('index.html')) return serveStatic(res, dir2+'/index.html');

                        tryStatic(dirs);
                    });
                });
            };

            tryStatic(staticDirs.slice());
        });
    });

    server.listen(port, hostname, () => {
        console.log(`Server running at http://${hostname}:${port}`);
    });
};

function serveStatic(res, filename) {
    fs.readFile(filename, (err, data) => {
        if (err) return res.send('Not found', 404);

        let ext = path.extname(filename);
        let mimeTypes = {
            ['.png']: 'image/png',
            ['.jpg']: 'image/jpeg',
            ['.css']: 'text/css',
            ['.js']: 'application/javascript',
            ['.json']: 'application/json',
            ['.html']: 'text/html',
            ['.txt']: 'text/plain',
        }
        let contentType = mimeTypes[ext];

		res.setHeader('Cache-Control', 'public, max-age=86400');
        return res.send(data, 200, contentType);
    });
}
