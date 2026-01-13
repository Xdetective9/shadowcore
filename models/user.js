const { db } = require('../database/db');
const bcrypt = require('bcryptjs');

class User {
  static create(username, email, password) {
    return new Promise((resolve, reject) => {
      bcrypt.hash(password, 10, (err, hash) => {
        if (err) reject(err);
        db.run('INSERT INTO users (username, email, password) VALUES (?, ?, ?)', [username, email, hash], function(err) {
          if (err) reject(err);
          resolve(this.lastID);
        });
      });
    });
  }

  static findByEmail(email) {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM users WHERE email = ?', [email], (err, row) => {
        if (err) reject(err);
        resolve(row);
      });
    });
  }

  static verify(id) {
    db.run('UPDATE users SET verified = 1 WHERE id = ?', [id]);
  }
}

module.exports = User;
