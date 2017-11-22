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

var storage = multer.diskStorage({
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

var fileUpload = multer({storage: storage}).any();

connection.query('USE ' + config.Login_db); // Locate Login DB

module.exports = function (app, passport) {

    app.use(bodyParser.urlencoded({extended: true}));
    app.use(bodyParser.json());

    // =====================================
    // HOME PAGE (with login links) ========
    // =====================================
    app.get('/', function (req, res) {
        // res.render('index.ejs'); // load the index.ejs file
        res.redirect('/login');
    });

    // =====================================
    // LOGIN ===============================
    // =====================================
    // show the login form
    app.get('/login', function (req, res) {

        // render the page and pass in any flash data if it exists
        res.render('login.ejs', {message: req.flash('loginMessage')});
    });

    // process the login form
    app.post('/login', passport.authenticate('local-login', {
            successRedirect: '/statusUpdate', // redirect to the secure profile section
            failureRedirect: '/login', // redirect back to the signup page if there is an error
            failureFlash: true // allow flash messages
        }),
        function (req, res) {
            if (req.body.remember) {
                req.session.cookie.maxAge = 1000 * 60 * 3;
                req.session.cookie.expires = false;
            }
            res.redirect('/login');
        });

    // Update user login status
    app.get('/statusUpdate', isLoggedIn, function (req, res) {
        res.setHeader("Access-Control-Allow-Origin", "*"); // Allow cross domain header
        var today = new Date();
        var date = today.getFullYear() + '-' + (today.getMonth() + 1) + '-' + today.getDate();
        var time2 = today.getHours() + ":" + today.getMinutes() + ":" + today.getSeconds();
        var dateTime = date + ' ' + time2;

        var statusUpdate = "UPDATE Users SET status = 'Active', lastLoginTime = ? WHERE username = ?";

        connection.query(statusUpdate,[dateTime, req.user.username],function(err, rows) {
            // console.log(dateTime, req.user.username);

            if (err) {
                console.log(err);
                res.render('login.ejs', {message: req.flash('Please try to login again')});
            } else {
                res.redirect('/userhome');
                // render the page and pass in any flash data if it exists
            }
        })
    });

    // =====================================
    // USER PROFILE SECTION ================
    // =====================================
    // we will want this protected so you have to be logged in to visit
    // we will use route middleware to verify this (the isLoggedIn function)

    // Show user profile page
    app.get('/userProfile', function (req, res) {
        res.render('userProfile.ejs', {user: req.user});
    });

    // Update user profile page
    app.post('/userProfile', function (req, res) {
        res.setHeader("Access-Control-Allow-Origin", "*"); // Allow cross domain header
        // connection.query('USE ' + config.Login_db); // Locate Login DB
        var user = req.user;
        var newPassword = {
            firestname: req.body.usernameF,
            lastname: req.body.usernameL,
            username: req.body.username,
            currentpassword: req.body.currentpassword,
            Newpassword: bcrypt.hashSync(req.body.newpassword, null, null),
            ConfirmPassword: bcrypt.hashSync(req.body.Confirmpassword, null, null)
        };
        // var changeusername = "'UPDATE Users Set password = '" + newPassword.usernameF + "' WHERE username        "

        var changepassword = "UPDATE Users SET password = '" + newPassword.Newpassword + "' WHERE username = '" + user.username + "'";
        console.log(newPassword.Newpassword, user.username);
        connection.query("SELECT * FROM Users WHERE username = ?", [user.username], function (err, rows) {
            // console.log(rows);
            var result = bcrypt.compareSync(newPassword.currentpassword, user.password);
            console.log(result);
            if (result) {
                console.log("Password correct");
                connection.query(changepassword, function (err, rows) {

                    if (err) {
                        console.log(err);
                        res.send("New Password Change Fail!");
                        res.end();
                    } else {
                        res.render('userHome.ejs', {
                            user: req.user // get the user out of session and pass to template
                        });
                    }
                })
            } else {
                console.log("Password wrong");
            }

        });
    });

    // =====================================
    // USER MANAGEMENT SECTION =============
    // =====================================
    // we will want this protected so you have to be logged in to visit
    // we will use route middleware to verify this (the isLoggedIn function)

    // Show user management home page
    app.get('/userManagement', isLoggedIn, function (req, res) {
        var UserQuery = "SELECT userrole FROM Users WHERE username = '" + req.user.username + "';";

        connection.query(UserQuery, function (err, results, fields) {

            if (!results[0].userrole) {
                console.log("Error");
            } else if (results[0].userrole === "Admin" || "Regular") {
                // process the signup form
                res.render('userManagement.ejs', {
                    user: req.user // get the user out of session and pass to template
                });
            }
        });
    });

    // show the signup form
    app.get('/signup', isLoggedIn, function (req, res) {

        // render the page and pass in any flash data if it exists
        res.render('signup.ejs', {
            user: req.user,
            message: req.flash('signupMessage')
        });
    });

    app.post('/signup', isLoggedIn, function (req, res) {

        res.setHeader("Access-Control-Allow-Origin", "*"); // Allow cross domain header
        // connection.query('USE ' + config.Login_db); // Locate Login DB

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

        var insertQuery = "INSERT INTO Users ( username, firstName, lastName, password, userrole, dateCreated, dateModified, createdUser, status) VALUES (?,?,?,?,?,?,?,?,?)";

        connection.query(insertQuery, [newUser.username, newUser.firstName, newUser.lastName, newUser.password, newUser.userrole, newUser.dateCreated, newUser.dateModified, newUser.createdUser, newUser.status], function (err, rows) {

            //newUser.id = rows.insertId;

            if (err) {
                console.log(err);
                res.send("New User Insert Fail!");
                res.end();
            } else {
                res.render('userHome.ejs', {
                    user: req.user // get the user out of session and pass to template
                });
            }
        });
    });

    // Filter by search criteria
    app.get('/filterUser', function (req, res) {

        console.log("dQ: " + req.query.dateCreatedFrom);
        // connection.query('USE ' + config.Login_db);

        var queryStat = "SELECT * FROM Users WHERE ";
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
            if (!!myQuery[i].fieldVal) {
                if (i == 0) {
                    queryStat += myQuery[i].dbCol + myQuery[i].op + myQuery[i].fieldVal + "'";
                } else {
                    queryStat += " AND " + myQuery[i].dbCol + myQuery[i].op + myQuery[i].fieldVal + "'";
                    if (i == myQuery.length - 1) {
                        userQuery()
                    }
                }
            } else {
                if (i == myQuery.length - 1) {
                    userQuery()
                }
            }
        }
    });


    // Show user edit form
    app.get('/editUser', isLoggedIn, function(req, res) {
        res.render('userEdit.ejs', {
            user: req.user, // get the user out of session and pass to template
            editUser: req.query.Username,
            firstName: req.query.First_Name,
            lastName: req.query.Last_Name,
            userrole: req.query.User_Role,
            status: req.query.Status,
            message: req.flash('Data Entry Message')
        });
    });

    // Retrieve user data from user management page
    app.post('/editUser', isLoggedIn, function(err, res, field) {

        if (err) {
            console.log(err);
            res.json({"error": true, "message": "No user data found!"});
        } else {
            res.json({"error": false, "message": "/editUser"});
        }
    });

    // =====================================
    // TRANSACTION SECTION =================
    // =====================================
    // we will want this protected so you have to be logged in to visit
    // we will use route middleware to verify this (the isLoggedIn function)

    app.get('/userhome', isLoggedIn, function (req, res) {
        var queryStatementTest = "SELECT userrole FROM Users WHERE username = '" + req.user.username + "';";

        connection.query(queryStatementTest, function (err, results, fields) {
            //console.log(results);

            if (!results[0].userrole) {
                console.log("Error");
            } else if (results[0].userrole === "Admin" || "Regular") {
                // process the signup form
                res.render('userHome.ejs', {
                    user: req.user // get the user out of session and pass to template
                });
            }
        });
    });

    // Prepare and assign new transaction ID
    app.get('/newEntry', isLoggedIn, function (req, res) {
        var d = new Date();
        var utcDateTime = d.getUTCFullYear() + "-" + ('0' + (d.getUTCMonth() + 1)).slice(-2) + "-" + ('0' + d.getUTCDate()).slice(-2);
        var queryTransID = "SELECT COUNT(transactionID) AS number FROM FAW.Transaction WHERE transactionID LIKE '" + utcDateTime + "%';";

        connection.query(queryTransID, function (err, results, fields) {
            transactionID = utcDateTime + "_" + ('0000' + (results[0].number + 1)).slice(-5);
            if (err) {
                console.log(err);
            } else {
                var insertTransID = "INSERT INTO FAW.Transaction (transactionID, Cr_UN) VALUE (" + "'" + transactionID + "', '" + req.user.username + "');";
                connection.query(insertTransID, function (err, results, fields) {
                    if (err) {
                        console.log(err);
                    } else {
                        if (req.user.userrole === "Admin") {
                            console.log(req.user.firstName);
                            res.redirect('/detailedForm');

                        } else if (req.user.userrole === "Regular") {
                            // res.render('insert_Armyworm_Regular.ejs', {
                            //     user: req.user, // get the user out of session and pass to template
                            //     message: req.flash('Data Entry Message')
                            // });
                            res.redirect('/generalForm');
                        }
                    }
                });
            }
        });
    });

    // Show general form
    app.get('/generalForm', isLoggedIn, function (req, res) {
        // console.log("A01");
        res.render('generalForm.ejs', {
            user: req.user, // get the user out of session and pass to template
            message: req.flash('Data Entry Message'),
            firstname: req.user.firstName,
            lastname: req.user.lastName,
            transactionID: transactionID
        });
    });

    // Submit general form
    app.post('/generalForm', isLoggedIn, function (req, res) {
        res.setHeader("Access-Control-Allow-Origin", "*");
        console.log(req.body);

        var result = Object.keys(req.body).map(function (key) {
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

        connection.query(deleteStatement + insertStatement, function (err, results, fields) {
            console.log("Z");
            if (err) {
                console.log(err);
                res.json({"error": true, "message": "Insert Error! Check your entry."});
            } else {
                res.json({"error": false, "message": "/detailedForm"});
                // var type = req.body.entryType;
                // if (type === "SCOUTING") {
                //     console.log("A1");
                //     res.redirect('/detailedForm');
                // } else if (type === "TRAP") {
                //     console.log("B1");// console.log("B");
                //     res.redirect('/detailedForm');
                // }
            }
        });
    });

    //Show detailed form
    app.get('/detailedForm', isLoggedIn, function (req, res) {
        res.render('detailedForm.ejs', {
            user: req.user, // get the user out of session and pass to template
            message: req.flash('Data Entry Message'),
            transactionID: transactionID
        });
    });

    // Upload photos
    app.post('/upload', fileUpload, function (req,res) {
        console.log("ABC");
        //console.log(req.headers.origin);
        res.setHeader("Access-Control-Allow-Origin", "*");

        fileUpload(req, res, function (err) {
            if (err) {
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

    // Submit detailed form
    app.post('/detailedForm', isLoggedIn, function (req, res) {
        console.log("AZ");
    });

    // show the data query form
    app.get('/query', isLoggedIn, function (req, res) {
        var DataQuery = "SELECT userrole FROM Users WHERE username = '" + req.user.username + "';";

        connection.query(DataQuery, function (err, results, fields) {

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



    app.get('/DataQuery', isLoggedIn, function (req, res) {

        var startDate = req.query.startDate;
        var endDate = req.query.endDate;
        var queryStatement = "SELECT * FROM FAW_Data_Entry WHERE Date >= '" + startDate + "' AND Date <= '" + endDate + "' ORDER BY Date;";

        res.setHeader("Access-Control-Allow-Origin", "*");

        connection.query(queryStatement, function (err, results, fields) {

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

// =====================================
// SIGNOUT =============================
// =====================================
//shouw the signout form
app.get('/signout', function (req, res) {
    req.session.destroy();
    req.logout();
    res.redirect('/login');
});

// route middleware to make sure
function isLoggedIn(req, res, next) {

    // if user is authenticated in the session, carry on
    if (req.isAuthenticated())
        return next();

    // if they aren't redirect them to the home page
    res.redirect('/');
}