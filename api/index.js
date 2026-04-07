const { app, initializeApp } = require('../server');

module.exports = async (req, res) => {
  try {
    await initializeApp();
    return app(req, res);
  } catch (error) {
    console.error('Serverless init error:', error.message);
    return res.status(500).json({ message: 'Server initialization failed' });
  }
};
