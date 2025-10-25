const mysql = require('mysql2');

// Create a connection to the database
const db = mysql.createConnection({
    host: 'localhost',     // MySQL host (default for XAMPP is localhost)
    user: 'root',          // MySQL user (default for XAMPP is 'root')
    password: '',          // MySQL password (default for XAMPP is an empty string)
    database: 'db_project_bangon' // Replace with your database name
});

// Connect to the MySQL database
db.connect((err) => {
    if (err) {
        console.error('Error connecting to the database:', err.stack);
        return;
    }
    console.log('Connected to the MySQL database');
});

module.exports = db;
