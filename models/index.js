const User = require('./User');
const Sloka = require('./Sloka');
const Video = require('./Video');
const Story = require('./Story');
const Movie = require('./Movie');
const Category = require('./Category');

// Relationships
User.belongsToMany(Sloka, { through: 'UserBookmarks', as: 'bookmarkedSlokas' });
Sloka.belongsToMany(User, { through: 'UserBookmarks' });

Video.belongsTo(User, { foreignKey: 'uploadedBy', as: 'uploader' });
Story.belongsTo(User, { foreignKey: 'createdBy', as: 'author' });

module.exports = {
  User,
  Sloka,
  Video,
  Story,
  Movie,
  Category
};
