// set up ======================================================================
// get all the tools we need
var express  = require('express');
var session  = require('express-session');
var MySQLStore = require('express-mysql-session')(session);
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var morgan = require('morgan');
var config = require('./config/mainconf');
var app      = express();
var port     = process.env.PORT || config.Server_Port;
var path    = require('path');
var passport = require('passport');
var flash    = require('connect-flash');
var fs = require('fs');

// configuration ===============================================================
// connect to our database

require('./config/passport')(passport); // pass passport for configuration


// set up our express application
app.use(express.static(__dirname));
app.use(morgan('dev')); // log every request to the console
app.use(cookieParser()); // read cookies (needed for auth)
app.use(bodyParser.urlencoded({extended: true}));
app.use(bodyParser.json());
app.use("/css", express.static(__dirname + "/css"));
app.use("/scripts", express.static(__dirname + "/scripts"));
app.use("/config", express.static(__dirname + "/config"));
app.use("/uploadfiles", express.static(__dirname + "/uploadfiles"));
app.use("/pic", express.static(__dirname + "/pic"));

app.set('views', path.join(__dirname, './', 'views'));
app.engine('ejs', require('ejs').renderFile);
app.set('view engine', 'ejs');

//app.set('view engine', 'ejs'); // set up ejs for templating

// required for passport
var options = {
    host: config.session_connection.host,
    port: config.session_connection.port,
    user: config.session_connection.user,
    password: config.session_connection.password,
    database: config.Session_db,
    checkExpirationInterval: 120000,// How frequently expired sessions will be cleared; milliseconds.
    expiration: 1800000,// The maximum age of a valid session; milliseconds.
    createDatabaseTable: true,// Whether or not to create the sessions database table, if one does not already exist.
    connectionLimit: 10,// Number of connections when creating a connection pool
    schema: {
        tableName: 'Sessions',
        columnNames: {
            session_id: 'Session_ID',
            expires: 'Expires',
            data: 'Data'
        }
    }
};

var sessionStore = new MySQLStore(options);

// var opts = {
//     uri: '/password_reset',
//     from: 'password-robot@localhost',
//     transportType: 'SMTP',
//     transportOptions: {
//         service: "Gmail",
//         auth: {
//             user: "aaaa.zhao@g.feitianacademy.org",
//             pass: "12344321"
//         }
//     }
// };

app.use(session({
    secret: 'Uesei9872',
    store: sessionStore,
    resave: false,
    saveUninitialized: false
 })); // session secret

app.use(passport.initialize());
app.use(passport.session()); // persistent login sessions
app.use(flash()); // use connect-flash for flash messages stored in session

// example nodemailer config here
// var forgot = require('./config/NodeMailer')(opts);
//
//
//
// app.use(forgot.middleware);


// routes ======================================================================
require('./app/routes.js')(app, passport); // load our routes and pass in our app and fully configured passport

// launch ======================================================================
app.listen(port);
console.log('The magic happens on port ' + port);