// app/routes.js
var multer = require('multer');
var mysql = require('mysql');
var config = require('../config/mainconf');
var connection = mysql.createConnection(config.commondb_connection);
var uploadPath = config.Upload_Path;
var bodyParser = require('body-parser');
var bcrypt = require('bcrypt-nodejs');

var filePathName = "";
var transactionID;

var storage =   multer.diskStorage({
    destination: function (req, file, callback) {
        callback(null, uploadPath);
    },
    filename: function (req, file, callback) {
        //console.log(file.fieldname + " " + file.originalname);
        filePathName += file.fieldname + '-' + file.originalname + ";";
        //console.log(filePathName);
        callback(null, file.fieldname + '-' + file.originalname);
    }
});

var fileUpload = multer({ storage : storage}).any();

module.exports = function(app, passport) {

    app.use(bodyParser.urlencoded({extended: true}));
    app.use(bodyParser.json());

    // =====================================
    // HOME PAGE (with login links) ========
    // =====================================
    app.get('/', function(req, res) {
        // res.render('index.ejs'); // load the index.ejs file
        res.redirect('/login');
    });

    // =====================================
    // LOGIN ===============================
    // =====================================
    // show the login form
    app.get('/login', function(req, res) {

        // render the page and pass in any flash data if it exists
        res.render('login.ejs', { message: req.flash('loginMessage') });
    });

    // process the login form
    app.post('/login', passport.authenticate('local-login', {
            successRedirect : '/profile', // redirect to the secure profile section
            failureRedirect : '/login', // redirect back to the signup page if there is an error
            failureFlash : true // allow flash messages
        }),
        function(req, res) {
            if (req.body.remember) {
                req.session.cookie.maxAge = 1000 * 60 * 3;
            } else {
                req.session.cookie.expires = false;
            }
            res.redirect('/login');
        });

    // =====================================
    // SIGNUP ==============================
    // =====================================
    // show the signup form
    app.get('/signup', function (req, res) {
        // render the page and pass in any flash data if it exists
        res.render('signup.ejs', {message: req.flash('signupMessage')});
    });

    app.post('/signup', function(req, res){

        res.setHeader("Access-Control-Allow-Origin", "*"); // Allow cross domain header
        connection.query('USE ' + config.Login_db); // Locate Login DB

        var newUser = {
            username: req.body.username,
            password: bcrypt.hashSync(req.body.password, null, null),  // use the generateHash function
            userrole: req.body.userrole
        };

        var insertQuery = "INSERT INTO FAW.Users ( username, password, userrole ) VALUES (?,?,?)";

        connection.query(insertQuery,[newUser.username, newUser.password, newUser.userrole],function(err, rows) {

            //newUser.id = rows.insertId;

            if (err) {
                console.log(err);
                res.send("New User Insert Fail!");
                res.end();
            } else {
                res.render('profile_Admin.ejs', {
                    user: req.user // get the user out of session and pass to template
                });
            }
        });
    });

    // =====================================
    // PROFILE SECTION =========================
    // =====================================
    // we will want this protected so you have to be logged in to visit
    // we will use route middleware to verify this (the isLoggedIn function)
    app.get('/profile', isLoggedIn, function(req, res) {
        var queryStatementTest = "SELECT userrole FROM FAW.Users WHERE username = '" + req.user.username + "';";

        connection.query(queryStatementTest, function(err, results, fields) {
            //console.log(results);

            if (!results[0].userrole) {
                console.log("Error");
            } else if (results[0].userrole === "Admin") {
                // process the signup form
                res.render('profile_Admin.ejs', {
                    user: req.user // get the user out of session and pass to template
                });
            } else if (results[0].userrole === "Regular") {
                res.render('profile_Regular.ejs', {
                    user: req.user // get the user out of session and pass to template
                });
            }
        });
    });

    // =====================================
    // LOGOUT ==============================
    // =====================================
    app.get('/logout', function(req, res) {
        req.logout();
        res.redirect('/');
    });

    app.post('/upload', fileUpload, function(req,res){
        //console.log(req.headers.origin);
        res.setHeader("Access-Control-Allow-Origin", "*");

        fileUpload(req,res,function(err) {
            if(err) {
                console.log(err);
                res.json({"error": true, "message": "Fail"});
                filePathName = "";
                //res.send("Error uploading file.");
            } else {
                console.log("Success:" + filePathName);
                res.json({"error": false, "message": filePathName});
                filePathName = "";
                //res.send("File is uploaded");
            }
        });
    });

    app.get('/submit', isLoggedIn, function(req,res){
        res.render('detailedForm.ejs', {
            user: req.user, // get the user out of session and pass to template
            message: req.flash('Data Entry Message'),
            transactionID: transactionID
        });
    });

    app.post('/submit', isLoggedIn, function(req,res){
        console.log("AZ");
    });

    app.get('/continue', isLoggedIn, function(req,res){
        // console.log("A01");
        res.render('generalForm.ejs', {
            user: req.user, // get the user out of session and pass to template
            message: req.flash('Data Entry Message'),
            firstname: req.user.firstName,
            lastname: req.user.lastName,
            transactionID: transactionID
        });
    });

    app.post('/continue', isLoggedIn, function(req,res){
        res.setHeader("Access-Control-Allow-Origin", "*");
        console.log(req.body);

        var result = Object.keys(req.body).map(function(key) {
            return [String(key), req.body[key]];
        });

        var name = "";
        var value = "";

        for (var i = 0; i < result.length; i++) {
            if (result[i][0] === "latitudeDirection" || result[i][0] === "longitudeDirection") {
                // lati and long
                name += result[i][0].substring(0, result[i][0].length - 9) + ", ";
                value += '"' + result[i][1] + " " + result[i + 1][1] + "° " + result[i + 2][1] + "' " + result[i + 3][1] + "''" + '"' + ", ";
                i = i + 3;
            } else if (result[i][0] === "rota_inter_crop" && result[i][1] === "OTHER") {
                // other main crop
                name += result[i][0] + ", ";
                value += '"' + result[i + 1][1] + '"' + ", ";
                i = i + 1;
            } else if (result[i][0] === "fieldSizeInteger") {
                // field size
                name += result[i][0].substring(0, result[i][0].length - 7) + ", ";
                // one decimal place = divide by 10
                value += '"' + (parseFloat(result[i][1]) + (result[i + 1][1] / 10)) + '"' + ", ";
                i = i + 1;
            } else {
                // normal
                if (result[i][1] !== "") {
                    name += result[i][0] + ", ";
                    value += '"' + result[i][1] + '"' + ", ";
                }
            }
        }
        name = name.substring(0, name.length - 2);
        value = value.substring(0, value.length - 2);

        // console.log(name);
        // console.log(value);
        var deleteStatement = "DELETE FROM FAW.General_Form WHERE transactionID = '" + transactionID + "'; ";
        var insertStatement = "INSERT INTO FAW.General_Form (" + name + ") VALUES (" + value + ");";
        console.log(insertStatement);

        connection.query(deleteStatement + insertStatement, function(err, results, fields) {
            console.log("Z");
            if (err) {
                console.log(err);
                res.json({"error": true, "message": "Insert Error! Check your entry."});
            } else {
                res.json({"error": false, "message": "/submit"});
                // var type = req.body.entryType;
                // if (type === "SCOUTING") {
                //     console.log("A1");
                //     res.redirect('/submit');
                // } else if (type === "TRAP") {
                //     console.log("B1");// console.log("B");
                //     res.redirect('/submit');
                // }
            }
        });
    });

    app.get('/dataEntry', isLoggedIn, function(req, res) {
        var queryStatementTest = "SELECT userrole FROM FAW.Users WHERE username = '" + req.user.username + "';";

        connection.query(queryStatementTest, function(err, results, fields) {

            if (!results[0].userrole) {
                console.log("Error");
            } else if (results[0].userrole === "Admin") {
                // process the signup form
                res.render('dataEntry_Home_Admin.ejs', {
                    user: req.user, // get the user out of session and pass to template
                    message: req.flash('Data Entry Message')
                });
            } else if (results[0].userrole === "Regular") {
                res.render('dataEntry_Home_Regular.ejs', {
                    user: req.user, // get the user out of session and pass to template
                    message: req.flash('Data Entry Message')
                });
            }
        });
    });

    app.get('/dataEntry1', isLoggedIn, function(req, res) {
        var d = new Date();
        var utcDateTime = d.getUTCFullYear() + "-" + ('0' + (d.getUTCMonth() + 1)).slice(-2) + "-" + ('0' + d.getUTCDate()).slice(-2);
        var queryStatementTest = "SELECT COUNT(transactionID) AS number FROM FAW.Transaction WHERE transactionID LIKE '" + utcDateTime + "%';";

        connection.query(queryStatementTest, function(err, results, fields) {
            transactionID = utcDateTime + "_" + ('0000' + (results[0].number + 1)).slice(-5);
            if (err) {
                console.log(err);
            } else {
                var queryStatementTest2 = "INSERT INTO FAW.Transaction (transactionID, Cr_UN) VALUE (" + "'" + transactionID + "', '" + req.user.username + "');";
                connection.query(queryStatementTest2, function(err, results, fields) {
                    if (err) {
                        console.log(err);
                    } else {
                        if (req.user.userrole === "Admin") {
                            console.log(req.user.firstName);
                            res.redirect('/submit');

                        } else if (req.user.userrole === "Regular") {
                            // res.render('insert_Armyworm_Regular.ejs', {
                            //     user: req.user, // get the user out of session and pass to template
                            //     message: req.flash('Data Entry Message')
                            // });
                            res.redirect('/continue');
                        }
                    }
                });
            }
        });
    });

    app.get('/dataEntry2', isLoggedIn, function(req, res) {
        var queryStatementTest = "SELECT userrole FROM FAW.Users WHERE username = '" + req.user.username + "';";

        connection.query(queryStatementTest, function(err, results, fields) {

            if (!results[0].userrole) {
                console.log("Error");
            } else if (results[0].userrole === "Admin") {
                // process the signup form
                res.render('insert_Armyworm_Admin.ejs', {
                    user: req.user, // get the user out of session and pass to template
                    message: req.flash('Data Entry Message')
                });
            } else if (results[0].userrole === "Regular") {
                res.render('insert_Armyworm_Regular.ejs', {
                    user: req.user, // get the user out of session and pass to template
                    message: req.flash('Data Entry Message')
                });
            }
        });
    });

    app.get('/dataEntry3', isLoggedIn, function(req, res) {
        var queryStatementTest = "SELECT userrole FROM FAW.Users WHERE username = '" + req.user.username + "';";

        connection.query(queryStatementTest, function(err, results, fields) {

            if (!results[0].userrole) {
                console.log("Error");
            } else if (results[0].userrole === "Admin") {
                // process the signup form
                res.render('insert_Armyworm_Admin.ejs', {
                    user: req.user, // get the user out of session and pass to template
                    message: req.flash('Data Entry Message')
                });
            } else if (results[0].userrole === "Regular") {
                res.render('insert_Armyworm_Regular.ejs', {
                    user: req.user, // get the user out of session and pass to template
                    message: req.flash('Data Entry Message')
                });
            }
        });
    });

    app.get('/insert', function (req, res) {

        connection.query('USE ' + config.Upload_db);

        var insertInfo = req.query.statement;
        var insertStatement = "INSERT INTO FAW.FAW_Data_Entry VALUES (" + insertInfo + ");";

        res.setHeader("Access-Control-Allow-Origin", "*");

        connection.query(insertStatement, function(err, results, fields) {
            if (err) {
                console.log(err);
                res.send("fail");
                res.end();
            } else {
                res.send("success");
                res.end();
            }
        });
    });

    // show the data query form
    app.get('/dataQuery', isLoggedIn, function(req, res) {
        var queryStatementTest = "SELECT userrole FROM FAW.Users WHERE username = '" + req.user.username + "';";

        connection.query(queryStatementTest, function(err, results, fields) {

            if (!results[0].userrole) {
                console.log("Error");
            } else if (results[0].userrole === "Admin") {
                // process the signup form
                res.render('query_Admin.ejs', {
                    user: req.user, // get the user out of session and pass to template
                    message: req.flash('Data Entry Message')
                });
            } else if (results[0].userrole === "Regular") {
                res.render('query_Regular.ejs', {
                    user: req.user, // get the user out of session and pass to template
                    message: req.flash('Data Query Message')
                });
            }
        });
    });

    app.get('/query', function (req, res) {

        connection.query('USE ' + config.Upload_db);

        var startDate = req.query.startDate;
        var endDate = req.query.endDate;
        var queryStatement = "SELECT * FROM FAW.FAW_Data_Entry WHERE Date >= '" + startDate + "' AND Date <= '" + endDate + "' ORDER BY Date;";

        res.setHeader("Access-Control-Allow-Origin", "*");

        connection.query(queryStatement, function(err, results, fields) {

            var status = [{errStatus: ""}];

            if (err) {
                console.log(err);
                status[0].errStatus = "fail";
                res.send(status);
                res.end();
            } else if (results.length === 0) {
                status[0].errStatus = "no data entry";
                res.send(status);
                res.end();
            } else {
                var JSONresult = JSON.stringify(results, null, "\t");
                res.send(JSONresult);
                res.end();
            }
        });
    });

};

// route middleware to make sure
function isLoggedIn(req, res, next) {

    // if user is authenticated in the session, carry on
    if (req.isAuthenticated())
        return next();

    // if they aren't redirect them to the home page
    res.redirect('/');
}
