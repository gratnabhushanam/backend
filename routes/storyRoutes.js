const express = require('express');
const router = express.Router();
const storyController = require('../controllers/storyController');
const { protect, admin } = require('../middleware/authMiddleware');

router.get('/', storyController.getStories);
router.get('/kids', storyController.getKidsStories);
router.post('/', protect, admin, storyController.addStory);
router.patch('/:id', protect, admin, storyController.updateStory);
router.delete('/:id', protect, admin, storyController.deleteStory);

module.exports = router;
