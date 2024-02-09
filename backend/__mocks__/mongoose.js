jest.unmock('mongoose');
const mongoose = require('mongoose');

let mockDB = mongoose;
let mockMongo;

jest.mock('../modules/db/db', () => {
  return { 
    connectDB: async () => {
      try {
        const { MongoMemoryServer } = require('mongodb-memory-server');
        mockMongo = await MongoMemoryServer.create();
        await mockDB.connect(mockMongo.getUri(), { dbName: 'verifyMAIN' });
        console.log('Connected to MongoDB');
      } catch (err) {
        console.error('Error connecting to MongoDB:', err);
        throw err;
      }
    },
    disconnectDB: async () => {
      await mockMongo.stop();
      await mockDB.disconnect();
      console.log('Disconnected from MongoDB');
    }
  };
});
