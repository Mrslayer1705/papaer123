const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    // Check if we're in mock mode
    if (process.env.USE_MOCK_DATA === 'true') {
      console.log('Using mock database connection');
      return;
    }

    const conn = await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/paper-trading', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`Error: ${error.message}`);
    console.log('Continuing without database connection in mock mode');
  }
};

module.exports = connectDB;
