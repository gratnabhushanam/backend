const { Story } = require('../models');
const { Op } = require('sequelize');
const { mapStory } = require('../utils/responseMappers');
const mockContentStore = require('../utils/mockContentStore');
const { isMockMode } = require('./authController');

exports.getStories = async (req, res) => {
  try {
    if (isMockMode()) {
      return res.json(mockContentStore.listStories().map(mapStory));
    }

    const stories = await Story.findAll();
    res.json(stories.map(mapStory));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.addStory = async (req, res) => {
  try {
    const primaryTitle = req.body.title
      || req.body.titleEnglish
      || req.body.titleHindi
      || req.body.titleTelugu
      || 'Untitled Story';

    const payload = {
      ...req.body,
      title: primaryTitle,
      seriesTitle: req.body.seriesTitle || 'Bhagavad Gita',
      bgmEnabled: req.body.bgmEnabled !== false,
      bgmPreset: req.body.bgmPreset || 'temple',
    };

    if (isMockMode()) {
      const newStory = mockContentStore.addStory(payload);
      return res.status(201).json(mapStory(newStory));
    }

    const newStory = await Story.create(payload);
    res.status(201).json(mapStory(newStory));
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.getKidsStories = async (req, res) => {
  try {
    if (isMockMode()) {
      const stories = mockContentStore
        .listStories()
        .filter((story) => Array.isArray(story.tags) && story.tags.some((tag) => String(tag).toLowerCase().includes('kids')));
      return res.json(stories.map(mapStory));
    }

    const stories = await Story.findAll({
       where: {
          tags: {
             [Op.like]: '%kids%'
          }
       }
    });
    res.json(stories.map(mapStory));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.deleteStory = async (req, res) => {
  try {
    const { id } = req.params;

    if (isMockMode()) {
      const removedStory = mockContentStore.deleteStory(id);
      if (!removedStory) {
        return res.status(404).json({ message: 'Story not found' });
      }
      return res.json({ message: 'Story deleted successfully', id: removedStory.id });
    }

    const story = await Story.findByPk(id);
    if (!story) {
      return res.status(404).json({ message: 'Story not found' });
    }

    await story.destroy();
    return res.json({ message: 'Story deleted successfully', id: Number(id) });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.updateStory = async (req, res) => {
  try {
    const { id } = req.params;

    const incomingTitle = req.body.title
      || req.body.titleEnglish
      || req.body.titleHindi
      || req.body.titleTelugu;

    if (isMockMode()) {
      const existingStories = mockContentStore.listStories();
      const storyIndex = existingStories.findIndex((story) => Number(story.id) === Number(id));
      if (storyIndex === -1) {
        return res.status(404).json({ message: 'Story not found' });
      }

      const updated = {
        ...existingStories[storyIndex],
        ...req.body,
        title: incomingTitle || existingStories[storyIndex].title,
        seriesTitle: req.body.seriesTitle || existingStories[storyIndex].seriesTitle || 'Bhagavad Gita',
        bgmEnabled: typeof req.body.bgmEnabled === 'boolean' ? req.body.bgmEnabled : existingStories[storyIndex].bgmEnabled !== false,
        bgmPreset: req.body.bgmPreset || existingStories[storyIndex].bgmPreset || 'temple',
        id: existingStories[storyIndex].id,
        updatedAt: new Date().toISOString(),
      };

      mockContentStore.replaceStory(Number(id), updated);
      return res.json(mapStory(updated));
    }

    const story = await Story.findByPk(id);
    if (!story) {
      return res.status(404).json({ message: 'Story not found' });
    }

    await story.update({
      ...req.body,
      title: incomingTitle || story.title,
      seriesTitle: req.body.seriesTitle || story.seriesTitle || 'Bhagavad Gita',
      bgmEnabled: typeof req.body.bgmEnabled === 'boolean' ? req.body.bgmEnabled : story.bgmEnabled !== false,
      bgmPreset: req.body.bgmPreset || story.bgmPreset || 'temple',
    });
    return res.json(mapStory(story));
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
};
