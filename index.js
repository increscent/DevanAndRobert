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

app.post('/rsvp/submit', (req, res) => {
    let attending_reception = req.body.attending_reception == 'yes';
    let attending_sealing = req.body.attending_sealing == 'yes';
    let reception_guest_count = attending_reception ? req.body.reception_guest_count : 0;
    let sealing_guest_count = attending_sealing ? req.body.sealing_guest_count : 0;

    db.query(
        db.expr('INSERT INTO rsvp ('
            + 'id, '
            + 'email, '
            + 'name, '
            + 'attending_reception, '
            + 'attending_sealing, '
            + 'reception_guest_count, '
            + 'sealing_guest_count, '
            + 'ip'
            + ') values (?, ?, ?, ?, ?, ?, ?, ?);',
            uuid(),
            req.body.email,
            req.body.name,
            attending_reception ? 1 : 0,
            attending_sealing ? 1 : 0,
            reception_guest_count || 0,
            sealing_guest_count || 0,
            req.ip
        ),
        (error) => {
            sendEmail('robert@increscent.org', 'RSVP Failed', JSON.stringify({error, body: req.body}));
            res.sendFile('./public/rsvp_failed.html');
        },
        () => res.sendFile('./public/rsvp_submitted.html')
    );
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
