const fs = require('fs');
const child_process = require('child_process');

var sqlite = null;

var request_buffer = [];
var response_buffer = [];

module.exports = {
    connect,
    query,
    expr,
};

function emptyOnError(err) {
    if (err) console.log(err);
}

function emptyOnSuccess(data) {
}

function expr(sql, ...params) {
    return [sql, ...params].map(x => x.toString().replace(/\n/g, '')).join('\n');
}

function query(sql, onError, onSuccess) {
    onError = onError || emptyOnError;
    onSuccess = onSuccess || emptyOnSuccess;

    if (!sqlite || sqlite.exitCode !== null) return onError('No connection');

    request_buffer.push({sql, onError, onSuccess});

    if (request_buffer.length == 1) {
        sendQuery();
    }
}

function sendQuery() {
    if (request_buffer.length == 0) return;

    response_buffer = [];

    let {sql, onError, onSuccess} = request_buffer[0];

    sqlite.stdin.write(`${sql}\n`);
}

function processResponse(str) {
    if (request_buffer.length == 0) return;

    response_buffer = response_buffer.concat(str.split('\n').filter(x => x));

    if (response_buffer.includes('QUERY')) {
        // end of query
        
        let {onError, onSuccess} = request_buffer[0];

        let rows = [];
        let currentRow = {};
        for (let i = 0; i < response_buffer.length; i++) {
            let line = response_buffer[i];

            if (line == 'QUERY') {
                break;
            } else if (line == 'ROW') {
                rows.push(currentRow);
                currentRow = {};
            } else {
                let nextLine = response_buffer[i+1];
                currentRow[line] = nextLine == '(null)' ? null : nextLine;
                i++;
            }
        }

        if (currentRow.FAIL) {
            onError(currentRow.FAIL);
        } else {
            onSuccess(rows);
        }

        // This has to be done directly before in case something gets added after the callback
        // There was a nasty race condition where `sendQuery` would be called twice per query,
        // once here and another time when the query was added because of the unsynchronized request buffer
        request_buffer.shift();
        if (request_buffer.length > 0) {
            sendQuery();
        }
    }
}

function connect(sqlitePath, dbPath, pwdPath) {
    sqlite = child_process.spawn(sqlitePath, [dbPath], {cwd: pwdPath});

    sqlite.stdout.on('data', (data) => processResponse(data.toString()));

    sqlite.on('close', () => {
        if (request_buffer.length > 0) {
            let {onError, onSuccess} = request_buffer.shift();
            onError('Connection closed');
        }

        connect(sqlitePath, dbPath, pwdPath);
    });
}
