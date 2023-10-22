const mongoose = require('mongoose');
const connectDB = async () => {
  mongoose.set('strictQuery', false);
  const conn = await mongoose.connect(process.env.MONGO_URI, {
    useUnifiedTopology: true
  });
  console.log(`MongoDb Connected ${conn.connection.host}`.cyan.underline);
};
module.exports = connectDB;
