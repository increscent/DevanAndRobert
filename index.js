const {v4: uuid} = require('uuid');
const nodemailer = require('nodemailer');
const server = require('./server.js');
const config = require('./config.js');
const db = require('./db.js');

db.connect(config.db.sqlitePath, config.db.dbPath, config.db.pwdPath);

let app = server({
    port: config.server.port,
    staticDirs: ['./public'],
    notFoundPage: './public/404.html'
});

app.get('/rsvp/download', (req, res) => {
    if (req.queryString == config.auth.password) {
        db.query('SELECT * FROM rsvp ORDER BY time DESC',
            (error) => res.sendJson({error}, 500),
            (data) => {
                let csvHeader = '"Name", "Attending Reception", "Reception Guest Count", "Attending Sealing", "Sealing Guest Count", "RSVP Date"';
                let csvLines = data.map(row => {
                    let name = row.name.replace(/"/g, '""');
                    let attendingReception = row.attending_reception == '1' ? 'Yes' : 'No';
                    let attendingSealing = row.attending_sealing == '1' ? 'Yes' : 'No';
                    let rsvpDate = (new Date(parseInt(row.time))).toString();
                    return `"${name}", ${attendingReception}, ${row.reception_guest_count}, ${attendingSealing}, ${row.sealing_guest_count}, ${rsvpDate}`;
                });

                let csv = [csvHeader, ...csvLines].join('\n');

                res.send(csv, 200, 'text/csv');
            }
        );
    } else {
        res.send('Not Authorized', 401);
    }
});

app.post('/rsvp/submit', (req, res) => {
    let attending_reception = req.body.attending_reception == 'yes';
    let attending_sealing = req.body.attending_sealing == 'yes';
    let reception_guest_count = attending_reception ? req.body.reception_guest_count : 0;
    let sealing_guest_count = attending_sealing ? req.body.sealing_guest_count : 0;

    db.query(
        db.expr('INSERT INTO rsvp ('
            + 'id, '
            + 'name, '
            + 'attending_reception, '
            + 'attending_sealing, '
            + 'reception_guest_count, '
            + 'sealing_guest_count, '
            + 'time'
            + ') values (?, ?, ?, ?, ?, ?, ?);',
            uuid(),
            req.body.name,
            attending_reception ? 1 : 0,
            attending_sealing ? 1 : 0,
            reception_guest_count || 0,
            sealing_guest_count || 0,
            Date.now()
        ),
        (error) => {
            sendEmail('robert@increscent.org', 'RSVP Failed', JSON.stringify({error, body: req.body}));
            res.sendFile('./public/rsvp_failed.html');
        },
        () => res.sendFile('./public/rsvp_submitted.html')
    );
});

app.middleware((req, res) => {
    if (req.path.includes('.html') || !req.path.includes('.')) {
        db.query(
            db.expr('INSERT INTO stats (method, path, ip, time) values (?, ?, ?, ?)',
                req.method,
                req.path,
                req.ip,
                Date.now()
            )
        );
    }
});

var transporter = nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: true,
    auth: {
        user: config.smtp.username,
        pass: config.smtp.password,
    },
});

function sendEmail(to, subject, text) {
    transporter.sendMail({
        from: `"${config.smtp.name}" <${config.smtp.username}>`,
        to,
        subject,
        text,
    });
}
