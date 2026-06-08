const bcrypt = require('bcryptjs');

const ROUNDS = 12;

module.exports = {
  hash:    (plain)        => bcrypt.hash(plain, ROUNDS),
  compare: (plain, hashed) => bcrypt.compare(plain, hashed),
};
