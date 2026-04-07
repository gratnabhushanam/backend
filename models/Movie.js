const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const Movie = sequelize.define('Movie', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  title: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  description: {
    type: DataTypes.TEXT,
  },
  videoUrl: {
    type: DataTypes.STRING,
    allowNull: false,
    field: 'youtubeUrl',
  },
  thumbnail: {
    type: DataTypes.STRING,
  },
  releaseYear: {
    type: DataTypes.INTEGER,
  },
  ownerHistory: {
    type: DataTypes.TEXT,
  },
  tags: {
    type: DataTypes.JSON,
    defaultValue: [],
  },
}, {
  timestamps: true,
});

module.exports = Movie;
