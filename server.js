const http = require('http');
const fs = require('fs');
const path = require('path');

var PORT = null;
var HOSTNAME = null;
var STATIC_DIRS = null;
var NOT_FOUND_PAGE = null;
var HANDLERS = {};

module.exports = ({port, hostname, staticDirs, notFoundPage}) => {
    PORT = port || 80;
    HOSTNAME = hostname || '127.0.0.1';
    STATIC_DIRS = staticDirs || [];
    NOT_FOUND_PAGE = notFoundPage || null;

    const server = http.createServer((req, res) => {
        let [url, queryStr] = req.url.split('?', 2);

        req.query = parseQueryString(queryStr);

        let pathParts = getPathParts(url);

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

        res.sendFile = (filename, statusCode) => {
            serveStatic(res, filename, statusCode);
        };

        req.ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;

        let body = [];
        req.on('data', (chunk) => body.push(chunk));
        req.on('end', () => {
            let bodyStr = Buffer.concat(body).toString();

            switch (req.headers['content-type']) {
                case 'application/json':
                    try {
                        req.body = JSON.parse(bodyStr);
                    } catch (e) {
                        return res.send('Malformed JSON', 400);
                    }
                    break;

                case 'application/x-www-form-urlencoded':
                    req.body = parseQueryString(bodyStr);
                    break;

                default:
                    req.body = bodyStr;
            }

            let matchPath = (targetPath) => {
                let targetPathParts = targetPath.split('/').filter(x => x);

                return pathParts.length == targetPathParts.length &&
                    pathParts.map((x, i) => [x, targetPathParts[i]])
                    .reduce((acc, [x, y]) => (x == y) && acc, true);
            };

            let handler = (HANDLERS[req.method] || []).find((x) => matchPath(x.path));

            try {
                if (handler) return handler.handler(req, res);
            } catch (e) {
                console.log(e);
                return res.send('Internal Server Error', 500);
            }

            // try static files only for GET
            if (req.method != 'GET') return notFound(res);

            tryList = [
                `${req.path}`,
                `${req.path}/index.html`,
                `${req.path}.html`,
            ];

            let tryStatic = (dirs) => {
                if (dirs.length == 0) return notFound(res);

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

            tryStatic(STATIC_DIRS.slice());
        });
    });

    server.listen(PORT, HOSTNAME, () => {
        console.log(`Server running at http://${HOSTNAME}:${PORT}`);
    });

    let addHandler = (method, path, handler) => {
        HANDLERS[method] = [
            ...(HANDLERS[method] || []),
            {path, handler},
        ];
    };

    let handlerAdder = (method) => {
        return (path, handler) => {
            addHandler(method, path, handler);
        };
    };

    return {
        get:  handlerAdder('GET'),
        put: handlerAdder('PUT'),
        post: handlerAdder('POST'),
        delete: handlerAdder('DELETE'),
        head: handlerAdder('HEAD'),
        options: handlerAdder('OPTIONS'),
    };
};

function serveStatic(res, filename, statusCode) {
    fs.readFile(filename, (err, data) => {
        if (err) return notFound(res);

        let ext = path.extname(filename);
        let extensions = {
            ['.png']: ['image/png', 86400],
            ['.jpg']: ['image/jpeg', 86400],
            ['.css']: ['text/css', 60],
            ['.js']: ['application/javascript', 60],
            ['.json']: ['application/json', 60],
            ['.html']: ['text/html', 60],
            ['.txt']: ['text/plain', 60],
            ['.woff']: ['font/woff', 31557600],
            ['.woff2']: ['font/woff2', 31557600],
            ['.ttf']: ['font/ttf', 31557600],
            ['.svg']: ['image/svg+xml', 31557600],
            ['.eot']: ['application/vnd.ms-fontobject', 31557600],
        }
        let contentType = extensions[ext] ? extensions[ext][0] : 'text/plain';
        let maxAge = extensions[ext] ? extensions[ext][1] : 86400;

		res.setHeader('Cache-Control', `public, max-age=${maxAge}`);
        return res.send(data, statusCode || 200, contentType);
    });
}

function notFound(res) {
    if (NOT_FOUND_PAGE) {
        serveStatic(res, NOT_FOUND_PAGE, 404);
    } else {
        res.send('Not found', 404);
    }
}

function getPathParts(path) {
    return path
        .replace(/\.\./g, '')
        .split('/')
        .filter(x => x);
}

function parseQueryString(queryStr) {
    let query = {};
    if (queryStr) {
        queryStr
            .split('&')
            .map(x => x.split('='))
            .map(x => x.map(y => decodeURIComponent(y)))
            .map(([x, y]) => query[x] = y);
    }
    return query;
}
