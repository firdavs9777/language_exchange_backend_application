// config/db.js - FIXED DATABASE CONNECTION
const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    mongoose.set('strictQuery', false);
    
    console.log('🔄 Connecting to MongoDB...');
    
    // PERFORMANCE: Optimized connection settings
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      useUnifiedTopology: true,
      
      // Connection pool settings
      maxPoolSize: 10, // Maximum number of connections in the pool
      serverSelectionTimeoutMS: 5000, // Keep trying to send operations for 5 seconds
      socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
      
      // Connection timeouts
      connectTimeoutMS: 10000, // Give up initial connection after 10 seconds
      heartbeatFrequencyMS: 10000, // Send a ping every 10 seconds
      
      // Write concern for better performance
      writeConcern: {
        w: 'majority',
        j: true,
        wtimeout: 1000
      }
    });
    
    // SUCCESS MESSAGE - This should appear
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    console.log(`📊 Database: ${conn.connection.name}`);
    
    // Test the connection with a simple query
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log(`📂 Available collections: ${collections.length}`);
    
  } catch (error) {
    console.log(`❌ Database connection failed: ${error.message}`);
    console.log('🔍 Full error:', error);
    process.exit(1);
  }
};

// Connection event listeners for monitoring
mongoose.connection.on('connected', () => {
  console.log('🟢 Mongoose connected to MongoDB');
});

mongoose.connection.on('error', (err) => {
  console.log(`🔴 MongoDB Error: ${err}`);
});

mongoose.connection.on('disconnected', () => {
  console.log('🟡 MongoDB Disconnected');
});

// Graceful close on app termination
process.on('SIGINT', async () => {
  await mongoose.connection.close();
  console.log('🔌 MongoDB connection closed through app termination');
  process.exit(0);
});

module.exports = connectDB;