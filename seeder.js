const fs = require('fs');
const mongoose = require('mongoose');
const colors = require('colors');
const dotenv = require('dotenv');

// Load env vars
dotenv.config({ path: './config/config.env' });

// Load models
const Moment = require('./models/Moment');
const User = require('./models/User');
const Languages = require('./models/Language');
const Comments = require('./models/Comment');
// Connect to database
mongoose.connect(process.env.MONGO_URI, {
  useUnifiedTopology: true
});
// Read JSON files
const moments = JSON.parse(
  fs.readFileSync(`${__dirname}/_data/moments.json`, 'utf-8')
);
// Read JSON files
const users = JSON.parse(
  fs.readFileSync(`${__dirname}/_data/users.json`, 'utf-8')
);
// Read JSON files
const languages = JSON.parse(
  fs.readFileSync(`${__dirname}/_data/languages.json`, 'utf-8')
);

// Read JSON Files 
const comments = JSON.parse(
  fs.readFileSync(`${__dirname}/_data/comments.json`, 'utf-8')
);

// importData into DB
const importData = async () => {
  try {
    await Moment.create(moments);
    await User.create(users);
    await Languages.create(languages);
    await Comments.create(comments);
    console.log('Data Imported...'.green.inverse);
    process.exit();
  } catch (err) {
    console.log(err);
  }
};

// importData into DB
const deleteData = async () => {
  try {
    await Moment.deleteMany();
    await User.deleteMany();
    await Languages.deleteMany();
    await Comments.deleteMany();
    console.log('Data Destroyed...'.red.inverse);
    process.exit();
  } catch (err) {
    console.log(err);
  }
};
// node seeder -i command import data is called
if (process.argv[2] === '-i') {
  importData();
}
// node seeder -d delete data is called
else if (process.argv[2] === '-d') {
  deleteData();
}

// We can insert json data into database
// Above is the example
