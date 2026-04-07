const express = require('express');
const router = express.Router();
const { 
  registerUser, 
  verifyRegistrationOtp,
  resendRegistrationOtp,
  requestPasswordResetOtp,
  verifyPasswordResetOtp,
  getEmailHealth,
  loginUser, 
  getUserProfile, 
  toggleBookmark, 
  updateUserProfile,
  getAllUsers,
  getStats,
  deleteUserByAdmin,
  getCommunityProfiles,
} = require('../controllers/authController');
const { protect, admin } = require('../middleware/authMiddleware');

router.post('/register', registerUser);
router.post('/register/verify-otp', verifyRegistrationOtp);
router.post('/register/resend-otp', resendRegistrationOtp);
router.post('/forgot-password/request-otp', requestPasswordResetOtp);
router.post('/forgot-password/verify-otp', verifyPasswordResetOtp);
router.get('/email-health', getEmailHealth);
router.post('/login', loginUser);
router.route('/profile').get(protect, getUserProfile).put(protect, updateUserProfile);
router.get('/community', protect, getCommunityProfiles);
router.post('/bookmarks', protect, toggleBookmark);
router.post('/streak', protect, require('../controllers/authController').updateStreak);

// Admin Routes
router.get('/users', protect, admin, getAllUsers);
router.delete('/users/:id', protect, admin, deleteUserByAdmin);
router.get('/stats', protect, admin, getStats);

module.exports = router;
