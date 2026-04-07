const express = require('express');
const router = express.Router();
const {
	getVideos,
	addVideo,
	getReels,
	getKidsVideos,
	uploadUserReel,
	getUserReels,
	getMyReels,
	getUserReelModerationQueue,
	moderateUserReel,
	toggleUserReelLike,
	shareUserReel,
	addUserReelComment,
	updateMyReel,
	deleteMyReel,
	deleteVideo,
} = require('../controllers/videoController');
const { protect, admin } = require('../middleware/authMiddleware');
const { uploadReelVideo } = require('../middleware/uploadMiddleware');

router.get('/', getVideos);
router.get('/reels', getReels);
router.get('/kids', getKidsVideos);
router.get('/user-reels', getUserReels);
router.post('/user-reels', protect, uploadReelVideo.single('video'), uploadUserReel);
router.get('/user-reels/me', protect, getMyReels);
router.get('/user-reels/moderation', protect, admin, getUserReelModerationQueue);
router.patch('/user-reels/:id/moderate', protect, admin, moderateUserReel);
router.post('/user-reels/:id/like', protect, toggleUserReelLike);
router.post('/user-reels/:id/share', protect, shareUserReel);
router.post('/user-reels/:id/comments', protect, addUserReelComment);
router.patch('/user-reels/:id', protect, uploadReelVideo.single('video'), updateMyReel);
router.delete('/user-reels/:id', protect, deleteMyReel);
router.post('/', protect, admin, addVideo);
router.delete('/:id', protect, admin, deleteVideo);

module.exports = router;
