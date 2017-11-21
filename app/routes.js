// app/routes.js
var multer = require('multer');
var mysql = require('mysql');
var config = require('../config/mainconf');
var connection = mysql.createConnection(config.commondb_connection);
var uploadPath = config.Upload_Path;
var bodyParser = require('body-parser');
var bcrypt = require('bcrypt-nodejs');

var filePathName = "";

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
            successRedirect : '/userhome', // redirect to the secure profile section
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

        var insertQuery = "INSERT INTO users ( username, password, userrole ) VALUES (?,?,?)";

        connection.query(insertQuery,[newUser.username, newUser.password, newUser.userrole],function(err, rows) {

            //newUser.id = rows.insertId;

            if (err) {
                console.log(err);
                res.send("New User Insert Fail!");
                res.end();
            } else {
                res.render('user_home_Admin.ejs', {
                    user: req.user // get the user out of session and pass to template
                });
            }
        });
    });

// =====================================
    // SIGNOUT =========================
    // =====================================
    //shouw the signout form
    // app.get('/signout', function (req, res) {
    //     // render the page and pass in any flash data if it exists
    //     res.render('signout.ejs', {message: req.flash('signoutMessage')});
    // });
    //
    // app.post('/signout', passport.authenticate('local-signout', {
    //         successRedirect : '/userhome', // redirect to the secure profile section
    //         failureRedirect : '/signout', // redirect back to the signin page if there is an error
    //         failureFlash : true // allow flash messages
    //     }),
    //     function(req, res) {
    //         if (req.body.remember) {
    //             req.session.destroy();
    //         } else {
    //             req.session.cookie.expires = false;
    //         }
    //         res.redirect('/signout');
    //     });

    app.post('/session', function(req, res) {
        User.findOne({ username: req.body.username })
            .select('salt') // my mongoose schema doesn't fetches salt
            .select('password') // and password by default
            .exec(function(err, user) {
                if (err || user === null) throw err; // awful error handling here
                // mongoose schema methods which checks if the sent credentials
                // are equal to the hashed password (allows callback)
                user.hasEqualPassword(req.body.password, function(hasEqualPassword) {
                    if (hasEqualPassword) {
                        // if the password matches we do this:
                        req.session.authenticated = true; // flag the session, all logged-in check now check if authenticated is true (this is required for the secured-area-check-middleware)
                        req.session.user = user; // this is optionally. I have done this because I want to have the user credentials available
                        // another benefit of storing the user instance in the session is
                        // that we can gain from the speed of redis. If the user logs out we would have to save the user instance in the session (didn't tried this)
                        res.send(200); // sent the client that everything gone ok
                    } else {
                        res.send("wrong password", 500); // tells the client that the password was wrong (on production sys you want to hide what gone wronge)
                    }
                });
            });
    });
    app.delete('/session', function(req, res) {
        // here is our security check
        // if you use a isAuthenticated-middleware you could make this shorter
        if (req.session.authenticated) {
            // this destroys the current session (not really necessary because you get a new one
            req.session.destroy(function() {
                // if you don't want destroy the whole session, because you anyway get a new one you also could just change the flags and remove the private informations
                // req.session.user.save(callback(err, user)) // didn't checked this
                //delete req.session.user;  // remove credentials
                //req.session.authenticated = false; // set flag
                //res.clearCookie('connect.sid', { path: '/' }); // see comments above                res.send('removed session', 200); // tell the client everything went well
            });
        } else {
            res.send('cant remove public session', 500); // public sessions don't containt sensible information so we leave them
        }
    });
	// =====================================
	// PROFILE SECTION =========================
	// =====================================
	// we will want this protected so you have to be logged in to visit
	// we will use route middleware to verify this (the isLoggedIn function)
	app.get('/userhome', isLoggedIn, function(req, res) {
        var queryStatementTest = "SELECT userrole FROM Login_DB.users WHERE username = '" + req.user.username + "';";

        connection.query(queryStatementTest, function(err, results, fields) {
            //console.log(results);

            if (!results[0].userrole) {
                console.log("Error");
            } else if (results[0].userrole === "Admin") {
                // process the signup form
                res.render('user_home_Admin.ejs', {
                    user: req.user // get the user out of session and pass to template
                });
            } else if (results[0].userrole === "Regular") {
                res.render('user_home_Regular.ejs', {
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
                //console.log("Success:" + filePathName);
                res.json({"error": false, "message": filePathName});
                filePathName = "";
                //res.send("File is uploaded");
            }
        });
    });

    app.get('/dataEntry', isLoggedIn, function(req, res) {
        var queryStatementTest = "SELECT userrole FROM Login_DB.users WHERE username = '" + req.user.username + "';";

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
        var queryStatementTest = "SELECT userrole FROM Login_DB.users WHERE username = '" + req.user.username + "';";

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

    app.get('/dataEntry2', isLoggedIn, function(req, res) {
        var queryStatementTest = "SELECT userrole FROM Login_DB.users WHERE username = '" + req.user.username + "';";

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
        var queryStatementTest = "SELECT userrole FROM Login_DB.users WHERE username = '" + req.user.username + "';";

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
        var insertStatement = "INSERT INTO FAW_Data_Entry VALUES (" + insertInfo + ");";

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
        var queryStatementTest = "SELECT userrole FROM Login_DB.users WHERE username = '" + req.user.username + "';";

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
        var queryStatement = "SELECT * FROM FAW_Data_Entry WHERE Date >= '" + startDate + "' AND Date <= '" + endDate + "' ORDER BY Date;";

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

    app.get('/editUser', function (req, res) {

        console.log("dQ: " + req.query.dateCreatedFrom);
        connection.query('USE ' + config.Login_db);

        var queryStat = "SELECT * FROM userss WHERE ";
        var myQuery = [
            {
                fieldName: "dateCreatedFrom",
                fieldVal: req.query.dateCreatedFrom,
                dbCol: "dateCreated",
                op: " >= '"
            },
            {
                fieldName: "dateCreatedTo",
                fieldVal: req.query.dateCreatedTo,
                dbCol: "dateCreated",
                op: " <= '"
            },
            {
                fieldName: "dateModifiedFrom",
                fieldVal: req.query.dateModifiedFrom,
                dbCol: "dateModified",
                op: " >= '"
            },
            {
                fieldName: "dateModifiedTo",
                fieldVal: req.query.dateModifiedTo,
                dbCol: "dateModified",
                op: " <= '"
            },
            {
                fieldName: "firstName",
                fieldVal: req.query.firstName,
                dbCol: "firstName",
                op: " = '"
            },
            {
                fieldName: "lastName",
                fieldVal: req.query.lastName,
                dbCol: "lastName",
                op: " = '"
            },
            {
                fieldName: "userrole",
                fieldVal: req.query.userrole,
                dbCol: "userrole",
                op: " = '"
            }
        ];
    // console.log("length: " + myQuery.length);
    //
    // for (var j = 0; j < myQuery.length; j++) {
    //     console.log("myQuery[" + j + "].fieldVal: " + !!myQuery[j].fieldVal);
    //     // console.log([j] + ": " + myQuery[j].fieldName + ", " + myQuery[j].fieldVal + ", " + myQuery[j].dbCol);
    //     // queryStat += myQuery[j].dbCol + myQuery[j].op + myQuery[j].fieldVal + "'";
    //     // console.log("j = first," + "j = " + j + ":" + queryStat);
    // }

    function userQuery() {
        res.setHeader("Access-Control-Allow-Origin", "*");

        connection.query(queryStat, function (err, results, fields) {

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
                console.log(JSONresult);
                res.send(JSONresult);
                res.end();
            }
        });
    }
    for (var i = 0; i < myQuery.length; i++) {
        console.log("myQuery[" + i + "].fieldVal: " + !!myQuery[i].fieldVal);
        if (!!myQuery[i].fieldVal) {
            console.log(i);
            if (i == 0) {
                queryStat += myQuery[i].dbCol + myQuery[i].op + myQuery[i].fieldVal + "'";
                console.log("i = " + i + ":" + queryStat);
            } else {
                console.log(i + "-G");
                queryStat += " AND " + myQuery[i].dbCol + myQuery[i].op + myQuery[i].fieldVal + "'";
                console.log("i = " + i + ":" + queryStat);
                if (i == myQuery.length -1) {
                    console.log(i + " -U");
                    userQuery()
                }
            }
        } else {
            if (i == myQuery.length -1) {
                console.log(i + " -U");
                userQuery()
            }
        }
    }
  });
app.get('/userManagement', isLoggedIn, function(req, res) {
        var queryStatementTest = "SELECT userrole FROM Login_DB.userss WHERE username = '" + req.user.username + "';";

        connection.query(queryStatementTest, function(err, results, fields) {

            if (!results[0].userrole) {
                console.log("Error");
            } else if (results[0].userrole === "Admin") {
                // process the signup form
                res.render('userManagement_Admin.ejs', {
                    user: req.user, // get the user out of session and pass to template
                    message: req.flash('Data Entry Message')
                });
            } else if (results[0].userrole === "Regular") {
                res.render('userManagement_Regular.ejs', {
                    user: req.user, // get the user out of session and pass to template
                    message: req.flash('Data Query Message')
                });
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
