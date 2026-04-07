const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const Video = sequelize.define('Video', {
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
  category: {
    type: DataTypes.STRING,
  },
  language: {
    type: DataTypes.STRING,
    defaultValue: 'telugu',
  },
  duration: {
    type: DataTypes.STRING,
  },
  tags: {
    type: DataTypes.JSON,
    defaultValue: [],
  },
  views: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  isKids: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  isUserReel: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  uploadedBy: {
    type: DataTypes.INTEGER, // Foreign key to User id
  },
  uploadSource: {
    type: DataTypes.ENUM('user', 'admin'),
    defaultValue: 'admin',
  },
  contentType: {
    type: DataTypes.ENUM('spiritual', 'other'),
    defaultValue: 'spiritual',
  },
  moderationStatus: {
    type: DataTypes.ENUM('pending', 'approved', 'rejected'),
    defaultValue: 'approved',
  },
  moderationNote: {
    type: DataTypes.STRING,
  },
  reviewedBy: {
    type: DataTypes.INTEGER,
  },
  likesCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  sharesCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  commentsCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  likedBy: {
    type: DataTypes.JSON,
    defaultValue: [],
  },
  comments: {
    type: DataTypes.JSON,
    defaultValue: [],
  },
  chapter: {
    type: DataTypes.INTEGER,
  },
  moral: {
    type: DataTypes.TEXT,
  },
  script: {
    type: DataTypes.TEXT,
  },
}, {
  timestamps: true,
});

module.exports = Video;
