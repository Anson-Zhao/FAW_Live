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

connection.query('USE ' + config.Login_db); // Locate Login DB

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
    app.get('/signup', isLoggedIn, function (req, res) {

            // render the page and pass in any flash data if it exists
            res.render('signup.ejs', {
                user: req.user,
                message: req.flash('signupMessage')
            });
    });

    app.post('/signup', function(req, res){

        res.setHeader("Access-Control-Allow-Origin", "*"); // Allow cross domain header
        connection.query('USE ' + config.Login_db); // Locate Login DB

        var newUser = {
            username: req.body.username,
            firstName: req.body.firstName,
            lastName: req.body.lastName,
            password: bcrypt.hashSync(req.body.password, null, null),  // use the generateHash function
            userrole: req.body.userrole,
            dateCreated: req.body.dateCreated,
            createdUser: req.body.createdUser,
            dateModified: req.body.dateCreated,
            status: req.body.status
        };

        var insertQuery = "INSERT INTO users ( username, firstName, lastName, password, userrole, dateCreated, dateModified, createdUser, status) VALUES (?,?,?,?,?,?,?,?,?)";

        connection.query(insertQuery,[newUser.username, newUser.firstName, newUser.lastName, newUser.password, newUser.userrole, newUser.dateCreated, newUser.dateModified, newUser.createdUser, newUser.status],function(err, rows) {

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
	app.get('/profile', isLoggedIn, statusUpD, function(req, res) {
        connection.query('USE ' + config.Login_db); // Locate Login DB
        var queryStatementTest = "SELECT userrole FROM users WHERE username = '" + req.user.username + "';";

        connection.query(queryStatementTest, function(err, results, fields) {
            console.log(results);

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
		res.redirect('/login');
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
        var queryStatementTest = "SELECT userrole FROM users WHERE username = '" + req.user.username + "';";

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
        var queryStatementTest = "SELECT userrole FROM users WHERE username = '" + req.user.username + "';";

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
        var queryStatementTest = "SELECT userrole FROM users WHERE username = '" + req.user.username + "';";

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
        var queryStatementTest = "SELECT userrole FROM users WHERE username = '" + req.user.username + "';";

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

    app.get('/reset', function (req, res) {
        res.render('profile.ejs', {user:req.user});
    });

    app.post('/reset', function(req, res) {
        res.setHeader("Access-Control-Allow-Origin", "*"); // Allow cross domain header
        connection.query('USE ' + config.Login_db); // Locate Login DB
        var user = req.user;
        var newPassword = {
            firestname: req.body.usernameF,
            lastname: req.body.usernameL,
            username: req.body.username,
            currentpassword: req.body.currentpassword,
            Newpassword: bcrypt.hashSync(req.body.newpassword, null, null),
            ConfirmPassword:bcrypt.hashSync(req.body.Confirmpassword, null, null)
        };
        // var changeusername = "'UPDATE Users Set password = '" + newPassword.usernameF + "' WHERE username        "

        var changepassword = "UPDATE Users SET password = '" + newPassword.Newpassword + "' WHERE username = '" + user.username + "'";
        console.log(newPassword.Newpassword,user.username);
        connection.query("SELECT * FROM Users WHERE username = ?",[user.username], function(err, rows){
                       // console.log(rows);
            var result = bcrypt.compareSync(newPassword.currentpassword, user.password);
            console.log(result);
            if (result) {
                console.log("Password correct");
                connection.query(changepassword,function(err,rows){

                    if (err) {
                    console.log(err);
                    res.send("New Password Change Fail!");
                    res.end();
                } else {
                    res.render('profile_Admin.ejs', {
                        user: req.user // get the user out of session and pass to template
                    });
                }
                })
            } else {
                console.log("Password wrong");
            }

        });
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

    app.get('/filterUser', function (req, res) {

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



        for (var i = 0; i < myQuery.length; i++) {
            //console.log("myQuery[" + i + "].fieldVal: " + !!myQuery[i].fieldVal);
            if (!!myQuery[i].fieldVal) {
                //console.log(i);
                if (i == 0) {
                    queryStat += myQuery[i].dbCol + myQuery[i].op + myQuery[i].fieldVal + "'";
                    //console.log("i = " + i + ":" + queryStat);
                } else {
                    queryStat += " AND " + myQuery[i].dbCol + myQuery[i].op + myQuery[i].fieldVal + "'";
                    //console.log("i = " + i + ":" + queryStat);
                    if (i == myQuery.length -1) {
                        userQuery()
                    }
                }
            } else {
                if (i == myQuery.length -1) {
                    userQuery()
                }
            }
        }
    });

    app.get('/editUser', isLoggedIn, function(req, res) {
        console.log("query Name: " + req.query.ColName);
        console.log("query Value: " + req.query.Valu);
        var queryStatementTest = "SELECT userrole FROM Login_DB.userss WHERE username = '" + req.user.username + "';";

        connection.query(queryStatementTest, function(err, results, fields) {

            if (!results[0].userrole) {
                console.log("Error");
            } else if (results[0].userrole === "Admin") {
                // process the signup form
                res.render('userEdit_Admin.ejs', {
                    user: req.user, // get the user out of session and pass to template
                    editUser: req.body.username,
                    firstName: req.body.firstName,
                    lastName: req.body.lastName,
                    message: req.flash('Data Entry Message')
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

function statusUpD (req, res, next) {

    res.setHeader("Access-Control-Allow-Origin", "*"); // Allow cross domain header
    connection.query('USE ' + config.Login_db); // Locate Login DB
    var today = new Date();
    var date = today.getFullYear() + '-' + (today.getMonth() + 1) + '-' + today.getDate();
    var time2 = today.getHours() + ":" + today.getMinutes() + ":" + today.getSeconds();
    var dateTime = date + ' ' + time2;


    var changeUser = {
        username: req.user.username
    };
    // console.log(req.user.username);

    //var insertQuery2 = "UPDATE userss SET status = '" + changeUser.status + "', lastLoginTime = '" + changeUser.lastLoginTime + "' WHERE username = '" + changeUser.username +"';";
    var statusUpdate = "UPDATE userss SET status = 'Active', lastLoginTime = ? WHERE username = ?";

    connection.query(statusUpdate,[dateTime, changeUser.username],function(err, rows) {
        // console.log(dateTime, changeUser.username);

        //newUser.id = rows.insertId;

        if (err) {
            console.log(err);
            res.send("Login Fail!");
            res.end();
        } else {
            // res.redirect('/profile', {
            //     user: req.user // get the user out of session and pass to template
            // });
        }
    });

    return next();
}

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