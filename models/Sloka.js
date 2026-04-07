const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const Sloka = sequelize.define('Sloka', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  chapter: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  verse: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  sanskrit: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  teluguMeaning: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  hindiMeaning: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  englishMeaning: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  simpleExplanation: {
    type: DataTypes.TEXT,
  },
  realLifeExample: {
    type: DataTypes.TEXT,
  },
  audioUrl: {
    type: DataTypes.STRING,
  },
  audioUrlEnglish: {
    type: DataTypes.STRING,
  },
  audioUrlTelugu: {
    type: DataTypes.STRING,
  },
  audioUrlHindi: {
    type: DataTypes.STRING,
  },
  tags: {
    type: DataTypes.JSON, // To store array of tags
    defaultValue: [],
  },
  isDaily: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
}, {
  timestamps: true,
});

module.exports = Sloka;
