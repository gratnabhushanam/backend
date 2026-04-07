const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const Story = sequelize.define('Story', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  title: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  titleTelugu: {
    type: DataTypes.STRING,
  },
  titleHindi: {
    type: DataTypes.STRING,
  },
  titleEnglish: {
    type: DataTypes.STRING,
  },
  seriesTitle: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'Bhagavad Gita',
  },
  slug: {
    type: DataTypes.STRING,
    unique: true,
  },
  summary: {
    type: DataTypes.TEXT,
  },
  summaryTelugu: {
    type: DataTypes.TEXT,
  },
  summaryHindi: {
    type: DataTypes.TEXT,
  },
  summaryEnglish: {
    type: DataTypes.TEXT,
  },
  content: {
    type: DataTypes.TEXT('long'),
    allowNull: false,
  },
  contentTelugu: {
    type: DataTypes.TEXT('long'),
  },
  contentHindi: {
    type: DataTypes.TEXT('long'),
  },
  contentEnglish: {
    type: DataTypes.TEXT('long'),
  },
  chapter: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  language: {
    type: DataTypes.STRING,
    defaultValue: 'telugu',
  },
  thumbnail: {
    type: DataTypes.STRING,
  },
  tags: {
    type: DataTypes.JSON,
    defaultValue: [],
  },
  bgmEnabled: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
  bgmPreset: {
    type: DataTypes.STRING,
    defaultValue: 'temple',
  },
  createdBy: {
    type: DataTypes.INTEGER, // Foreign key to User id
  },
}, {
  timestamps: true,
});

module.exports = Story;
