const mongoose = require('mongoose');

const dbName = 'agent';
const uri = `mongodb+srv://${process.env.MONGODB_USERNAME}:${encodeURIComponent(process.env.MONGODB_PASSWORD)}@threadly.tamku2f.mongodb.net/${dbName}`;

async function connectDB() {
  try {
    await mongoose.connect(uri);
    console.log('Connected to MongoDB');
  } catch (err) {
    console.error('Error connecting to MongoDB:', err);
    throw err;
  }
}

module.exports = { connectDB };