const { Sequelize } = require('sequelize');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config();

const dialect = process.env.DB_DIALECT || 'sqlite';
const isSqlite = dialect === 'sqlite';
const sqliteStorage = process.env.SQLITE_STORAGE || path.join(__dirname, '..', 'data', 'gita_wisdom.sqlite');
const isProduction = String(process.env.NODE_ENV || '').toLowerCase() === 'production';
const isVercelRuntime = String(process.env.VERCEL || '').toLowerCase() === '1';
const allowProductionMock = String(process.env.ALLOW_PROD_MOCK || '').toLowerCase() === 'true' || isVercelRuntime;
const shouldAlterSchema = String(process.env.DB_SYNC_ALTER || (!isProduction).toString()).toLowerCase() === 'true';

const sequelize = isSqlite
  ? new Sequelize({
      dialect: 'sqlite',
      storage: sqliteStorage,
      logging: false,
    })
  : new Sequelize(
      process.env.DB_NAME || 'gita_wisdom',
      process.env.DB_USER || 'root',
      process.env.DB_PASSWORD || '',
      {
        host: process.env.DB_HOST || 'localhost',
        dialect,
        logging: false,
      }
    );

const connectDB = async () => {
  try {
    await sequelize.authenticate();
    if (isSqlite) {
      console.log(`SQLite Connected using Sequelize (${sqliteStorage})`);
    } else {
      console.log(`${dialect.toUpperCase()} Connected using Sequelize`);
    }
    // Sync models
    await sequelize.sync({ alter: shouldAlterSchema });
    console.log('Database synced');
  } catch (error) {
    console.error('Unable to connect to the MySQL database:', error.message);
    if (isProduction && !allowProductionMock) {
      throw new Error('Database connection failed in production. Mock mode is disabled for security.');
    }
    console.warn('Running backend without a database. Using mock authentication/content fallback.');
    require('../controllers/authController').setMockMode(true);
  }
};

module.exports = { sequelize, connectDB };
