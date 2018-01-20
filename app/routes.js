// app/routes.js
var multer = require('multer');
var mysql = require('mysql');
var config = require('../config/mainconf');
var connection = mysql.createConnection(config.commondb_connection);
var uploadPath = config.Upload_Path;
var bodyParser = require('body-parser');
var bcrypt = require('bcrypt-nodejs');
var nodemailer = require('nodemailer');
var async = require('async');
var crypto = require('crypto');

var filePathName = "";
var filePath, transactionID, myStat, myVal, myErrMsg, token, errStatus;
var today, date2, date3, time2, time3, dateTime, tokenExpire;

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

var smtpTrans = nodemailer.createTransport({
    service: 'Gmail',
    auth: {
        user: 'aaaa.zhao@g.feitianacademy.org',
        pass: "12344321"
    }
});

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
    // LOGIN PAGE===========================
    // =====================================
    // show the login form
    app.get('/login', function (req, res) {

        // render the page and pass in any flash data if it exists
        res.render('login.ejs', {message: req.flash('loginMessage')});
    });

    // process the login form
    app.post('/login', passport.authenticate('local-login', {
            successRedirect: '/loginUpdate', // redirect to the secure profile section
            failureRedirect: '/login', // redirect back to the signup page if there is an error
            failureFlash: true // allow flash messages
        }),
        function (req, res) {
            if (req.body.remember) {
                req.session.cookie.maxAge = 1000 * 60 * 3;
                req.session.cookie.expires = false;
            }
            //res.redirect('/login');
        });

    // Update user login status
    app.get('/loginUpdate', isLoggedIn, function (req, res) {
        dateNtime();

        myStat = "UPDATE Users SET status = 'Active', lastLoginTime = ? WHERE username = ?";
        myVal = [dateTime, req.user.username];
        myErrMsg = "Please try to login again";
        updateDBNredir(myStat, myVal, myErrMsg, "login.ejs", "/userhome", res);
    });

    app.get('/forgot', function (req, res) {
        res.render('forgotPassword.ejs', {message: req.flash('forgotPassMessage')});

    });

    app.post('/email', function (req, res) {
        res.setHeader("Access-Control-Allow-Origin", "*"); // Allow cross domain header
        async.waterfall([
            function(done) {
                crypto.randomBytes(20, function(err, buf) {
                    token = buf.toString('hex');
                    tokenExpTime();
                    done(err, token, tokenExpire);
                });
            },
            function (token, tokenExpire, done) {
                // connection.query( "INSERT INTO Users ( resetPasswordExpires, resetPasswordToken ) VALUES (?,?) WHERE username = '" + req.body,username + "'; ")
                myStat = "UPDATE Users SET resetPasswordToken = ?, resetPasswordExpires = ? WHERE username = '" + req.body.username + "' ";
                myVal = [token, tokenExpire];
                connection.query(myStat, myVal, function (err, rows) {

                    //newUser.id = rows.insertId;

                    if (err) {
                        console.log(err);
                        res.send("Token Insert Fail!");
                        res.end();
                    } else {
                        done(err, token);
                    }
                });
            },
            function(token, done, err) {
                // Message object
                var message = {
                    from: 'FTAA <aaaa.zhao@g.feitianacademy.org>', // sender info
                    to: req.body.username, // Comma separated list of recipients
                    subject: 'Password Reset', // Subject of the message

                    // plaintext body
                    text: 'You are receiving this because you (or someone else) have requested the reset of the password for your account.\n\n' +
                    'Please click on the following link, or paste this into your browser to complete the process:\n\n' +
                    'https://' + req.headers.host + '/reset/' + token + '\n\n' +
                    'If you did not request this, please ignore this email and your password will remain unchanged.\n'
                };

                smtpTrans.sendMail(message, function(error){
                    if(error){
                        console.log(error.message);
                        // alert('Something went wrong! Please double check if your email is valid.');
                        return;
                    } else {
                        res.send('Message sent successfully! Please check your email inbox.');
                        console.log('Message sent successfully!');
                        res.redirect('/login');
                        // alert('An e-mail has been sent to ' + req.body.username + ' with further instructions.');
                    }
                });
            }
        ], function(err) {
                if (err) return next(err);
                res.redirect('/forgot');
        });
    });

    app.get('/reset/:token', function(req, res) {
        res.setHeader("Access-Control-Allow-Origin", "*"); // Allow cross domain header

        myStat = "SELECT * FROM Users WHERE resetPasswordToken = '" + req.params.token + "'";

        connection.query(myStat, function(err, user) {
            dateNtime();
            var myDate1 = new Date(user[0].resetPasswordExpires);

            if (!user || dateTime > myDate1.toLocaleString()) {
                res.send('Password reset token is invalid or has expired. Please contact Administrator.');
            } else {
                res.render('reset.ejs', {
                    user: user[0]
                });
            }
        });
    });

    app.post('/reset/:token', function(req, res) {
        res.setHeader("Access-Control-Allow-Origin", "*"); // Allow cross domain header

        async.waterfall([
            function(done) {

                myStat = "SELECT * FROM Users WHERE resetPasswordToken = '" + req.params.token + "'";

                connection.query(myStat, function(err, user) {
                    var userInfo = JSON.stringify(user, null, "\t");
                    console.log("data: " + userInfo);
                    console.log("token: " + req.params.token);

                    if (!user) {
                        res.send('Password reset token is invalid or has expired. Please contact Administrator.');

                        console.log("Token invalid");
                    } else {
                        console.log("Token valid!");
                        console.log("password: " + req.body.newpassword);
                        var newPass = {
                            Newpassword: bcrypt.hashSync(req.body.newpassword, null, null),
                            ConfirmPassword: bcrypt.hashSync(req.body.Confirmpassword, null, null)
                        };

                        var passReset = "UPDATE Users SET password = '" + newPass.Newpassword + "' WHERE username = '" + req.body.username + "'";

                        connection.query(passReset, function (err, rows) {

                            if (err) {
                                console.log(err);
                                res.send("New Password Insert Fail!");
                            } else {
                                // done(err, user);
                                console.log("Password entered successfully!");
                                done()
                            }
                        });
                    }

                });
            }, function(user, done, err) {

                var message = {
                    from: 'FTAA <aaaa.zhao@g.feitianacademy.org>',
                    to: req.body.username,
                    subject: 'Your password has been changed',
                    text: 'Hello,\n\n' +
                    'This is a confirmation that the password for your account, ' + changeMail(req.body.username) + ' has just been changed.\n'
                };

                smtpTrans.sendMail(message, function (error) {
                    if(error){
                        console.log(error.message);
                        // alert('Something went wrong! Please double check if your email is valid.');
                        return;
                    } else {
                        console.log('Confirmation message sent successfully!');
                        res.redirect('/login');
                    }
                });
            }
        ]
        //     , function(err) {
        //     if (err) return next(err);
        //     res.redirect('/login');
        // }
        );
    });


    // =====================================
    // USER PROFILE  =======================
    // =====================================
    // we will want this protected so you have to be logged in to visit
    // we will use route middleware to verify this (the isLoggedIn function)

    // Show user profile page
    app.get('/userProfile', isLoggedIn, function (req, res) {
        res.render('userProfile.ejs', {user: req.user});
    });

    // Update user profile page
    app.post('/userProfile', isLoggedIn, function (req, res) {
        res.setHeader("Access-Control-Allow-Origin", "*"); // Allow cross domain header
        var user = req.user;
        var newPass = {
            firstname: req.body.usernameF,
            lastname: req.body.usernameL,
            currentpassword: req.body.currentpassword,
            Newpassword: bcrypt.hashSync(req.body.newpassword, null, null),
            ConfirmPassword: bcrypt.hashSync(req.body.Confirmpassword, null, null)
        };

        dateNtime();

        myStat = "UPDATE Users SET firstName =?, lastName = ?, dateModified  = ? WHERE username = ? ";
        myVal = [newPass.firstname, newPass.lastname, dateTime, user.username];

        connection.query(myStat, myVal, function (err, rows) {
            if(err){
                console.log(err);
                res.json({"error": true, "message": "Fail !"});
            } else {
                var passComp = bcrypt.compareSync(newPass.currentpassword, user.password);
                if (!!req.body.newpassword && passComp) {
                    var passReset = "UPDATE Users SET password = '" + newPass.Newpassword + "' WHERE username = '" + user.username + "'";

                    connection.query(passReset, function (err, rows) {
                        //console.log(result);
                        if (err) {
                            console.log(err);
                            res.json({"error": true, "message": "Fail !"});
                        } else {
                            res.json({"error": false, "message": "Success !"});
                        }
                    });
                } else {
                    res.json({"error": false, "message": "Success !"});
                }
            }
        });
    });

    // =====================================
    // USER MANAGEMENT =====================
    // =====================================
    // we will want this protected so you have to be logged in to visit
    // we will use route middleware to verify this (the isLoggedIn function)

    // Show user management home page
    app.get('/userManagement', isLoggedIn, function (req, res) {
        myStat = "SELECT userrole FROM Users WHERE username = '" + req.user.username + "';";

        connection.query(myStat, function (err, results, fields) {

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

        myStat = "INSERT INTO Users ( username, firstName, lastName, password, userrole, dateCreated, dateModified, createdUser, status) VALUES (?,?,?,?,?,?,?,?,?)";
        myVal = [newUser.username, newUser.firstName, newUser.lastName, newUser.password, newUser.userrole, newUser.dateCreated, newUser.dateModified, newUser.createdUser, newUser.status];
        connection.query(myStat, myVal, function (err, rows) {

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
    app.get('/filterUser', isLoggedIn, function (req, res) {
        myStat = "SELECT * FROM Users";

        var myQueryObj = [
            {
                fieldVal: req.query.dateCreatedFrom,
                dbCol: "dateCreated",
                op: " >= '",
                adj: req.query.dateCreatedFrom
            },
            {
                fieldVal: req.query.dateCreatedTo,
                dbCol: "dateCreated",
                op: " <= '",
                adj: req.query.dateCreatedTo
            },
            {
                fieldVal: req.query.dateModifiedFrom,
                dbCol: "dateModified",
                op: " >= '",
                adj: req.query.dateModifiedFrom
            },
            {
                fieldVal: req.query.dateModifiedTo,
                dbCol: "dateModified",
                op: " <= '",
                adj: req.query.dateModifiedTo
            },
            {
                fieldVal: req.query.firstName,
                dbCol: "firstName",
                op: " = '",
                adj: req.query.firstName
            },
            {
                fieldVal: req.query.lastName,
                dbCol: "lastName",
                op: " = '",
                adj: req.query.lastName
            },
            {
                fieldVal: req.query.userrole,
                dbCol: "userrole",
                op: " = '",
                adj: req.query.userrole
            }
        ];

        QueryStat(myQueryObj, myStat, res)
    });

    // Retrieve user data from user management page
    var edit_User, edit_firstName, edit_lastName, edit_userrole, edit_status;
    app.get('/editUserQuery', isLoggedIn, function(req, res) {

        edit_User = req.query.Username;
        edit_firstName = req.query.First_Name;
        edit_lastName = req.query.Last_Name;
        edit_userrole = req.query.User_Role;
        edit_status = req.query.Status;
        res.json({"error": false, "message": "/editUser"});
    });

    // Show user edit form
    app.get('/editUser', isLoggedIn, function(req, res) {
        res.render('userEdit.ejs', {
            user: req.user, // get the user out of session and pass to template
            userName: edit_User,
            firstName: edit_firstName,
            lastName: edit_lastName,
            userrole: edit_userrole,
            status: edit_status,
            message: req.flash('Data Entry Message')
        });
    });

    app.post('/editUser', isLoggedIn, function(req, res) {
        res.setHeader("Access-Control-Allow-Origin", "*"); // Allow cross domain header

        if (req.body.newPassword !== "") {
            var updatedUserPass = {
                firstName: req.body.First_Name,
                lastName: req.body.Last_Name,
                userrole: req.body.User_Role,
                status: req.body.Status,
                newPassword: bcrypt.hashSync(req.body.newPassword, null, null)
            };

            myStat = "UPDATE Users SET firstName = ?, lastName = ?, password = ?, userrole = ?, status = ?, modifiedUser = '" + req.user.username + "', dateModified = '" + dateTime + "' WHERE username = ?";
            myVal = [updatedUserPass.firstName, updatedUserPass.lastName, updatedUserPass.newPassword, updatedUserPass.userrole, updatedUserPass.status, edit_User];
            updateDBNres(myStat, myVal, "Update failed!", "/userManagement", res);

        } else {
            var updatedUser = {
                firstName: req.body.First_Name,
                lastName: req.body.Last_Name,
                userrole: req.body.User_Role,
                status: req.body.Status
            };

            myStat = "UPDATE Users SET firstName = ?, lastName = ?, userrole = ?, status = ?, modifiedUser = '" + req.user.username + "', dateModified = '" + dateTime + "'  WHERE username = ?";
            myVal = [updatedUser.firstName, updatedUser.lastName, updatedUser.userrole, updatedUser.status, edit_User];

            updateDBNres(myStat, myVal, "Update failed!", "/userManagement", res);
        }

    });

    app.get('/suspendUser', isLoggedIn, function(req, res) {
        res.setHeader("Access-Control-Allow-Origin", "*"); // Allow cross domain header
        dateNtime();

        var username = req.query.usernameStr.split(",");
        myStat = "UPDATE Users SET modifiedUser = '" + req.user.username + "', dateModified = '" + dateTime + "',  status = 'Suspended'";

        for (var i = 0; i < username.length; i++) {
            if (i === 0) {
                myStat += " WHERE username = '" + username[i] + "'";
                if (i === username.length - 1) {
                    updateDBNres(myStat, "", "Suspension failed!", "/userManagement", res);
                }
            } else {
                myStat += " OR username = '" + username[i] + "'";
                if (i === username.length - 1) {
                    updateDBNres(myStat, "", "Suspension failed!", "/userManagement", res);
                }
            }
        }
    });

    // =====================================
    // TRANSACTION SECTION =================
    // =====================================
    // we will want this protected so you have to be logged in to visit
    // we will use route middleware to verify this (the isLoggedIn function)

    app.get('/userhome', isLoggedIn, function (req, res) {
        var myStat = "SELECT userrole FROM Users WHERE username = '" + req.user.username + "';";

        connection.query(myStat, function (err, results, fields) {
            //console.log(results);

            if (!results[0].userrole) {
                console.log("Error");
            } else {
                res.render('userHome.ejs', {
                    user: req.user // get the user out of session and pass to template
                });
            }
        });
    });

    app.get('/deleteRow2', isLoggedIn, function(req, res) {
        del_recov("Deleted", "Deletion failed!", "/dataHistory", req, res);
    });

    app.get('/recoverRow2', isLoggedIn, function(req, res){
        del_recov("Active", "Recovery failed!", "/dataHistory", req, res);
    });

    app.get('/deleteRow', isLoggedIn, function(req, res) {
        del_recov("Deleted", "Deletion failed!", "/userHome", req, res);
    });

    app.get('/recoverRow', isLoggedIn, function(req, res){
        del_recov("Active", "Recovery failed!", "/userHome", req, res);
    });

    // edit on homepage
    var editData;
    app.get('/sendEditData', isLoggedIn, function(req, res) {
        var editTransactionID = req.query.transactionIDStr;
        console.log(editTransactionID);

        var scoutingStat = "SELECT Users.firstName, Users.lastName, General_Form.*, Detailed_Scouting.* FROM Transaction INNER JOIN Users ON Users.username = Transaction.Cr_UN INNER JOIN General_Form ON General_Form.transactionID = Transaction.transactionID INNER JOIN Detailed_Scouting ON Detailed_Scouting.transactionID = Transaction.transactionID WHERE Transaction.transactionID = '" + editTransactionID +"';";
        var trapStat = "SELECT Users.firstName, Users.lastName, General_Form.*, Detailed_Trap.* FROM Transaction INNER JOIN Users ON Users.username = Transaction.Cr_UN INNER JOIN General_Form ON General_Form.transactionID = Transaction.transactionID INNER JOIN Detailed_Trap ON Detailed_Trap.transactionID = Transaction.transactionID WHERE Transaction.transactionID = '" + editTransactionID + "';";

        connection.query(scoutingStat + trapStat, function (err, results, fields) {

            if (err) {
                console.log(err);
                res.json({"error": true, "message": "Fail"});
            } else {
                console.log(results);
                if (results[0].length > 0) {
                    editData = results[0][0];
                    res.json({"error": false, "message": "/editData"});
                } else if (results[1].length > 0) {
                    editData = results[1][0];
                    res.json({"error": false, "message": "/editData"});
                } else {
                    res.json({"error": true, "message": "Fail"});
                }
            }
        });
    });

    app.get('/editData', isLoggedIn, function(req, res) {
        console.log(editData.transactionID);
        res.render('dataEdit.ejs', {
            user: req.user,
            data: editData, // get the user out of session and pass to template
            message: req.flash('Data Entry Message')
        });
    });

    app.get('/recovery', isLoggedIn, function (req, res) {
        // render the page and pass in any flash data if it exists
        res.render('recovery.ejs', {
            user: req.user,
            message: req.flash('restoreMessage')
        });
    });

    app.get('/recovery2', isLoggedIn, function (req, res) {
        // render the page and pass in any flash data if it exists
        res.render('recovery_dataHistory.ejs', {
            user: req.user,
            message: req.flash('restoreMessage')
        });
    });

    // show the data history ejs
    app.get('/dataHistory', isLoggedIn, function (req, res) {
        res.render('dataHistory.ejs', {
            user: req.user // get the user out of session and pass to template
        });
    });

    app.get('/filterQuery', isLoggedIn, function (req, res) {
        var scoutingStat = "SELECT Users.username, Users.firstName, Users.lastName, General_Form.*, Detailed_Scouting.* FROM Transaction INNER JOIN Users ON Users.username = Transaction.Cr_UN INNER JOIN General_Form ON General_Form.transactionID = Transaction.transactionID INNER JOIN Detailed_Scouting ON Detailed_Scouting.transactionID = Transaction.transactionID";
        var trapStat = "SELECT Users.username, Users.firstName, Users.lastName, General_Form.*, Detailed_Trap.* FROM Transaction INNER JOIN Users ON Users.username = Transaction.Cr_UN INNER JOIN General_Form ON General_Form.transactionID = Transaction.transactionID INNER JOIN Detailed_Trap ON Detailed_Trap.transactionID = Transaction.transactionID";
        //console.log(req.query);
        var myQueryObj = [
            {
                fieldVal: req.query.statusDel,
                dbCol: "General_Form.Status_del",
                op: " = '",
                adj: req.query.statusDel,
                table: 1
            },
            {
                fieldVal: req.query.statusDel,
                dbCol: "Detailed_Scouting.Status_del",
                op: " = '",
                adj: req.query.statusDel,
                table: 2
            },
            {
                fieldVal: req.query.statusDel,
                dbCol: "Detailed_Trap.Status_del",
                op: " = '",
                adj: req.query.statusDel,
                table: 3
            },
            {
                fieldVal: req.query.firstName,
                dbCol: "firstName",
                op: " = '",
                adj: req.query.firstName,
                table: 1
            },
            {
                fieldVal: req.query.lastName,
                dbCol: "lastName",
                op: " = '",
                adj: req.query.lastName,
                table: 1
            },
            {
                fieldVal: req.query.startDate,
                dbCol: "date",
                op: " >= '",
                adj: req.query.startDate,
                table: 1
            },
            {
                fieldVal: req.query.endDate,
                dbCol: "date",
                op: " <= '",
                adj: req.query.endDate,
                table: 1
            },
            {
                fieldVal: req.query.content1,
                dbCol: req.query.filter1,
                op: " = '",
                adj: req.query.filter1,
                table: req.query.filter1
            },
            {
                fieldVal: req.query.content2,
                dbCol: req.query.filter2,
                op: " = '",
                adj: req.query.filter2,
                table: req.query.filter2
            },
            {
                fieldVal: req.query.content3,
                dbCol: req.query.filter3,
                op: " = '",
                adj: req.query.filter3,
                table: req.query.filter3
            }
        ];
        QueryStat(myQueryObj, scoutingStat, trapStat, res)
    });

    // Prepare and assign new transaction ID
    app.get('/newEntry', isLoggedIn, function (req, res) {
        var d = new Date();
        var utcDateTime = d.getUTCFullYear() + "-" + ('0' + (d.getUTCMonth() + 1)).slice(-2) + "-" + ('0' + d.getUTCDate()).slice(-2);
        var queryTransID = "SELECT COUNT(transactionID) AS number FROM Transaction WHERE transactionID LIKE '" + utcDateTime + "%';";

        connection.query(queryTransID, function (err, results, fields) {
            transactionID = utcDateTime + "_" + ('0000' + (results[0].number + 1)).slice(-5);
            if (err) {
                console.log(err);
            } else {
                var insertTransID = "INSERT INTO Transaction (transactionID, Cr_UN) VALUE (" + "'" + transactionID + "', '" + req.user.username + "');";
                connection.query(insertTransID, function (err, results, fields) {
                    if (err) {
                        console.log(err);
                    } else {
                        // Show general form
                        res.render('form.ejs', {
                            user: req.user, // get the user out of session and pass to template
                            message: req.flash('Data Entry Message'),
                            firstname: req.user.firstName,
                            lastname: req.user.lastName,
                            transactionID: transactionID
                        });
                    }
                });
            }
        });
    });

    // // Upload photos
    // app.post('/upload', fileUpload, function (req,res) {
    //     //console.log(req.headers.origin);
    //     res.setHeader("Access-Control-Allow-Origin", "*");
    //
    //     fileUpload(req, res, function (err) {
    //         if (err) {
    //             console.log(err);
    //             res.json({"error": true, "message": "Fail"});
    //             filePathName = "";
    //             //res.send("Error uploading file.");
    //         } else {
    //             console.log("Success:" + filePathName);
    //             filePath = filePathName;
    //             if (!!filePathName){
    //                 // filePath = editData.Photo_of_Pest + ";" + editData.Photo_of_Damage;
    //                 res.json({"error": false, "message": filePathName});
    //                 filePathName = "";
    //             } else {
    //                 var error = false;
    //                 filePath = editData.Photo_of_Pest + ";" + editData.Photo_of_Damage;
    //                 var files = (editData.Photo_of_Pest + ";" + editData.Photo_of_Damage).split(";");
    //                 for (var i = 0; i < files.length; i++) {
    //                     fs.unlink(files[i],function(err){
    //                         if(err) {
    //                             error = true;
    //                             res.json({"error": true, "message": "Upload Fail !"});
    //                             filePathName = "";
    //                         }
    //                     });
    //
    //                     if (i === files.length - 1 && error === false) {
    //                         res.json({"error": false, "message": filePathName});
    //                         filePathName = "";
    //                     }
    //                 }
    //             }
    //             // res.json({"error": false, "message": filePathName});
    //             // filePathName = "";
    //             //res.send("File is uploaded");
    //         }
    //     });
    // });

    // Upload photos
    app.post('/upload', fileUpload, function (req,res) {
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
                filePath = filePathName;
                res.json({"error": false, "message": filePathName});
                filePathName = "";
            }
        });
    });

    // Submit general form
    app.post('/generalForm', isLoggedIn, function (req, res) {
        res.setHeader("Access-Control-Allow-Origin", "*");
        //console.log(req.body);

        var result = Object.keys(req.body).map(function (key) {
            return [String(key), req.body[key]];
        });

        var name = "";
        var value = "";

        for (var i = 0; i < result.length; i++) {
            if (result[i][0] === "Latitude_direction" || result[i][0] === "Longitude_direction") {
                // lati and long
                name += result[i][0].substring(0, result[i][0].length - 10) + ", ";
                value += '"' + result[i][1] + " " + result[i + 1][1] + "° " + result[i + 2][1] + "' " + result[i + 3][1] + "''" + '"' + ", ";
                i = i + 3;
            } else if (result[i][0] === "Field_size_ha_integer") {
                // field size
                name += result[i][0].substring(0, result[i][0].length - 8) + ", ";
                // one decimal place = divide by 10
                value += '"' + (parseFloat(result[i][1]) + (result[i + 1][1] / 10)) + '"' + ", ";
                i = i + 1;
            } else if (result[i][0] === "Rotation_intercropping_crop") {
                name += result[i][0] + ", ";
                var str = result[i][1].toString();
                str = str.replace(/,/g, "/");
                value += '"' + str + '"' + ", ";
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
        var deleteStatement = "DELETE FROM General_Form WHERE transactionID = '" + req.body.transactionID + "'; ";
        var insertStatement = "INSERT INTO General_Form (" + name + ") VALUES (" + value + ");";
        console.log(insertStatement);

        connection.query(deleteStatement + insertStatement, function (err, results, fields) {
            if (err) {
                console.log(err);
                res.json({"error": true, "message": "Insert Error! Check your entry."});
            } else {
                res.json({"error": false, "message": "/detailedForm"});
            }
        });
    });

    // Submit detailed form Scouting
    app.post('/detailedFormScouting', isLoggedIn, function (req, res) {
        res.setHeader("Access-Control-Allow-Origin", "*");
        console.log(req.body);
        var result = Object.keys(req.body).map(function (key) {
            return [String(key), req.body[key]];
        });

        var name = "";
        var value = "";

        for (var i = 0; i < result.length; i++) {
            if (result[i][0] === "Pest_stage" || result[i][0] === "Control_undertaken") {
                name += result[i][0] + ", ";
                var str = result[i][1].toString();
                str = str.replace(/,/g, "/");
                value += '"' + str + '"' + ", ";
            } else {
                name += result[i][0] + ", ";
                value += '"' + result[i][1] + '"' + ", ";
            }
        }
        name = name.substring(0, name.length - 2);
        value = value.substring(0, value.length - 2);

        var path = filePath.split(";");
        //console.log(path);
        var damage = "";
        var pest = "";

        for (var i = 0; i < path.length - 1; i++) {
            //console.log("A");
            if (path[i].substring(0,12) === "Damage_photo") {
                damage += "https://aworldbridgelabs.com/uploadfiles/" + path[i] + ";";
            } else if (path[i].substring(0,10) === "Pest_photo") {
                pest += "https://aworldbridgelabs.com/uploadfiles/" + path[i] + ";";
            }
        }
        //console.log(pest + "  " + damage);
        damage = damage.substring(0, damage.length - 1);
        pest = pest.substring(0, pest.length - 1);

        name += ", Damage_photo, Pest_photo";
        value += ", '" + damage + "', '" + pest + "'";

        var deleteStatement = "DELETE FROM Detailed_Scouting WHERE transactionID = '" + req.body.transactionID + "'; ";
        var insertStatement = "INSERT INTO Detailed_Scouting (" + name + ") VALUES (" + value + ");";
        console.log(insertStatement);

        connection.query(deleteStatement + insertStatement, function (err, results, fields) {
            if (err) {
                console.log(err);
                res.json({"error": true, "message": "Insert Error! Check your entry."});
            } else {
                res.json({"error": false, "message": "/detailedForm"});
            }
        });
    });

    // Submit detailed form trap
    app.post('/detailedFormTrap', isLoggedIn, function (req, res) {
        res.setHeader("Access-Control-Allow-Origin", "*");
        console.log(req.body);
        var result = Object.keys(req.body).map(function (key) {
            return [String(key), req.body[key]];
        });

        var name = "";
        var value = "";

        for (var i = 0; i < result.length; i++) {
            name += result[i][0] + ", ";
            value += '"' + result[i][1] + '"' + ", ";
        }
        name = name.substring(0, name.length - 2);
        value = value.substring(0, value.length - 2);

        // var path = filePath.split(";");
        // console.log(path);
        // var damage = "";
        // var pest = "";
        //
        // for (var i = 0; i < path.length - 1; i++) {
        //     console.log("A");
        //     if (path[i].substring(0,12) === "Damage_photo") {
        //         damage += "https://aworldbridgelabs.com/uploadfiles/" + path[i] + ";";
        //     } else if (path[i].substring(0,10) === "Pest_photo") {
        //         pest += "https://aworldbridgelabs.com/uploadfiles/" + path[i] + ";";
        //     }
        // }
        // console.log(pest + "  " + damage);
        // damage = damage.substring(0, damage.length - 1);
        // pest = pest.substring(0, pest.length - 1);
        //
        // name += ", Damage_photo, Pest_photo";
        // value += ", '" + damage + "', '" + pest + "'";

        var deleteStatement = "DELETE FROM Detailed_Trap WHERE transactionID = '" + req.body.transactionID + "'; ";
        var insertStatement = "INSERT INTO Detailed_Trap (" + name + ") VALUES (" + value + ");";
        console.log(insertStatement);

        connection.query(deleteStatement + insertStatement, function (err, results, fields) {
            if (err) {
                console.log(err);
                res.json({"error": true, "message": "Insert Error! Check your entry."});
            } else {
                res.json({"error": false, "message": "/detailedForm"});
            }
        });
    });

    // =====================================
    // SIGNOUT =============================
    // =====================================
    //shouw the signout form
    app.get('/signout', function (req, res) {
        req.session.destroy();
        req.logout();
        res.redirect('/login');
    });

    app.get('Cancel', function (req, res) {
        res.redirect('/userHome');
        res.render('userHome', {
            user: req.user // get the user out of session and pass to template
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

function dateNtime() {
    today = new Date();
    date2 = today.getFullYear() + '-' + (today.getMonth() + 1) + '-' + today.getDate();
    time2 = today.getHours() + ":" + today.getMinutes() + ":" + today.getSeconds();
    dateTime = date2 + ' ' + time2;
}

function tokenExpTime() {
    today = new Date();
    date3 = today.getFullYear() + '-' + (today.getMonth() + 1) + '-' + (today.getDate()+1);
    time3 = today.getHours() + ":" + today.getMinutes() + ":" + today.getSeconds();
    tokenExpire = date3 + ' ' + time3;
}

function del_recov(StatusUpd, ErrMsg, targetURL, req, res) {

    transactionID = req.query.transactionIDStr.split(",");
    console.log(transactionID);
    var statementGeneral = "UPDATE General_Form SET Status_del = '" + StatusUpd + "'";
    var statementDetailedS = "UPDATE Detailed_Scouting SET Status_del = '" + StatusUpd + "'";
    var statementDetailedT = "UPDATE Detailed_Trap SET Status_del = '" + StatusUpd + "'";

    for (var i = 0; i < transactionID.length; i++) {
        if (i === 0) {
            statementGeneral += " WHERE transactionID = '" + transactionID[i] + "'";
            statementDetailedS += " WHERE transactionID = '" + transactionID[i] + "'";
            statementDetailedT += " WHERE transactionID = '" + transactionID[i] + "'";

            if (i === transactionID.length - 1) {
                statementGeneral += ";";
                statementDetailedS += ";";
                statementDetailedT += ";";
                myStat = statementGeneral + statementDetailedS + statementDetailedT;
                updateDBNres(myStat, "", ErrMsg, targetURL, res);
            }
        } else {
            statementGeneral += " OR transactionID = '" + transactionID[i] + "'";
            statementDetailedS += " OR transactionID = '" + transactionID[i] + "'";
            statementDetailedT += " OR transactionID = '" + transactionID[i] + "'";

            if (i === transactionID.length - 1) {
                statementGeneral += ";";
                statementDetailedS += ";";
                statementDetailedT += ";";
                myStat = statementGeneral + statementDetailedS + statementDetailedT;
                updateDBNres(myStat, "", ErrMsg, targetURL, res);
            }
        }
    }
}

function updateDBNres(SQLstatement, Value, ErrMsg, targetURL, res) {
    res.setHeader("Access-Control-Allow-Origin", "*"); // Allow cross domain header
    //console.log("Query Statement: " + SQLstatement);

    connection.query(SQLstatement, Value, function (err, rows) {
        if (err) {
            console.log(err);
            res.json({"error": true, "message": ErrMsg});
        } else { res.json({"error": false, "message": targetURL});}
    })
}

function updateDBNredir(SQLstatement, Value, ErrMsg, failURL, redirURL, res) {
    res.setHeader("Access-Control-Allow-Origin", "*"); // Allow cross domain header
    //console.log("Query Statement: " + SQLstatement);

    connection.query(SQLstatement, Value, function (err, rows) {
        if (err) {
            console.log(err);
            res.render(failURL, {message: req.flash(ErrMsg)});
        } else {
            res.redirect(redirURL);
            // render the page and pass in any flash data if it exists
        }
    })
}

function QueryStat(myObj, scoutingStat, trapStat, res) {
    var j = 0;
    for (var i = 0; i < myObj.length; i++) {
        //console.log("i = " + i);
        //console.log("field Value: " + !!myObj[i].fieldVal);
        if (!!myObj[i].adj){
            if (i === 7 || i === 8 || i === 9) {
                myObj[i].dbCol = myObj[i].dbCol.substring(1, myObj[i].dbCol.length);
                myObj[i].table = parseInt(myObj[i].table.substring(0, 1));
            }

            var aw;
            if (j === 0) {
                aw = " WHERE ";
                j = 1;
            } else {
                aw = " AND ";
            }

            if (myObj[i].table === 1) {
                scoutingStat = editStat(scoutingStat, aw, myObj[i].dbCol, myObj[i].op, myObj[i].fieldVal);
                trapStat = editStat(trapStat, aw, myObj[i].dbCol, myObj[i].op, myObj[i].fieldVal);
            } else if (myObj[i].table === 2) {
                scoutingStat = editStat(scoutingStat, aw, myObj[i].dbCol, myObj[i].op, myObj[i].fieldVal);
            } else if (myObj[i].table === 3) {
                trapStat = editStat(trapStat, aw, myObj[i].dbCol, myObj[i].op, myObj[i].fieldVal);
            }

            if (i === myObj.length - 1) {
                var sqlStatement = scoutingStat + "; " + trapStat;
                dataList(sqlStatement,res);
            }
        } else {
            if (i === myObj.length - 1) {
                var sqlStatement = scoutingStat + "; " + trapStat;
                dataList(sqlStatement,res);
            }
        }

        // if (!!myObj[i].adj) {
        //     if (j === 0) {
        //         j = 1;
        //         if (i === myObj.length - 1) {
        //             if (!!myObj[i].fieldVal) {
        //                 myNewStat += " WHERE " + myObj[i].dbCol + myObj[i].op + myObj[i].fieldVal + "'";
        //                 dataList(myNewStat,res)
        //             } else {
        //                 // myNewStat += " WHERE " + myObj[i].dbCol + " IS NULL";
        //                 dataList(myNewStat,res)
        //             }
        //         } else {
        //             if (!!myObj[i].fieldVal) {
        //                 myNewStat += " WHERE " + myObj[i].dbCol + myObj[i].op + myObj[i].fieldVal + "'";
        //             } else {
        //                 // myNewStat += " WHERE " + myObj[i].dbCol + " IS NULL";
        //             }
        //         }
        //     } else {
        //         if (i === myObj.length - 1) {
        //             if (!!myObj[i].fieldVal) {
        //                 myNewStat += " AND " + myObj[i].dbCol + myObj[i].op + myObj[i].fieldVal + "'";
        //                 dataList(myNewStat,res)
        //             } else {
        //                 // myNewStat += " AND " + myObj[i].dbCol + " IS NULL";
        //                 dataList(myNewStat,res)
        //             }
        //         } else {
        //             if (!!myObj[i].fieldVal) {
        //                 myNewStat += " AND " + myObj[i].dbCol + myObj[i].op + myObj[i].fieldVal + "'";
        //             } else {
        //                 // myNewStat += " AND " + myObj[i].dbCol + " IS NULL";
        //             }
        //         }
        //     }
        // } else {
        //     if (i === myObj.length - 1) {
        //         dataList(myNewStat,res)
        //     }
        // }
    }

    function editStat(stat, aw, dbCol, op, fieldVal) {
        stat += aw + dbCol + op + fieldVal + "'";
        return stat;
    }
}

function dataList(SQLstatement, res) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    //console.log(SQLstatement);
    connection.query(SQLstatement, function (err, results, fields) {

        errStatus = [{errMsg: ""}];

        if (err) {
            console.log(err);
            errStatus[0].errMsg = "fail";
            res.send(errStatus);
            res.end();
        } else if (results[0].length === 0 && results[1].length === 0) {
            errStatus[0].errMsg = "no data entry";
            res.send(errStatus);
            res.end();
        } else {
            var result = results[0].concat(results[1]);
            var JSONresult = JSON.stringify(result, null, "\t");
            // console.log(JSONresult);
            res.send(JSONresult);
            res.end();
        }
    });
}

function changeMail(str) {
    var spliti = str.split("@");
    var letter1 = spliti[0].substring(0, 1);
    var letter2 = spliti[0].substring(spliti[0].length - 1, spliti[0].length);
    var newFirst = letter1;
    for(i = 0; i < spliti[0].length - 2; i++) {
        newFirst += "*";
    }
    newFirst += letter2;

    var letter3 = spliti[1].substring(0, 1);
    var extension = letter3;
    for(i = 0; i < spliti[1].split(".")[0].length - 1; i++) {
        extension += "*";
    }
    extension += "." + spliti[1].split(".")[1];
    var result = newFirst + "@" + extension;

    return result;
}