// config/database.js
module.exports = {
    'commondb_connection': {
        'multipleStatements': true,
        'connectionLimit' : 100,
        'host': '10.11.4.97',
        'user': 'AppUser',
        'password': 'Special888%',
        'port'    :  3306
    },
    'session_connection': {
        'multipleStatements': true,
        'connectionLimit' : 100,
        'host': '10.11.4.97',
        'user': 'SessionManager',
        'password': 'SManager$44',
        'port'    :  3306
    },

    'Session_db': 'session_DB',
    'Login_db': 'FAWv4',
    'Login_table': 'Users',
    'Upload_db': 'FAWv4',

    'Server_Port': 9088,

    'Upload_Path': 'http://faw.aworldbridgelabs.com/uploadfiles'

};
