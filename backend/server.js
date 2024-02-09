require('dotenv').config();
const { connectDB } = require('./modules/db/db');


(async () => {
  await connectDB();
  const app = require('./app');
  const port = process.env.PORT || 3000;
  app.listen(port, () => {
    console.log(`Server running on port ${port}`);
  });
})();