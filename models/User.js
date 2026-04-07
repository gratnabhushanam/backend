const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const User = sequelize.define('User', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    validate: { isEmail: true },
  },
  password: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  role: {
    type: DataTypes.ENUM('user', 'admin'),
    defaultValue: 'user',
  },
  language: {
    type: DataTypes.STRING,
    defaultValue: 'telugu',
  },
  streak: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  lastActive: {
    type: DataTypes.DATE,
    defaultValue: null,
  },
  bio: {
    type: DataTypes.TEXT,
  },
  profilePicture: {
    type: DataTypes.TEXT('long'), // For base64 storage
  },
  settings: {
    type: DataTypes.JSON, // To store notifications, privacy, interests
    defaultValue: {
      notifications: true,
      privacy: 'public',
      interests: [],
    },
  },
  benefits: {
    type: DataTypes.JSON, // To store points, badges
    defaultValue: {
      points: 0,
      badges: [],
    },
  },
}, {
  timestamps: true,
});

module.exports = User;
