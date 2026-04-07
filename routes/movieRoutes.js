const express = require('express');
const router = express.Router();
const { getMovies, addMovie, deleteMovie } = require('../controllers/movieController');
const { protect, admin } = require('../middleware/authMiddleware');

router.get('/', getMovies);
router.post('/', protect, admin, addMovie);
router.delete('/:id', protect, admin, deleteMovie);

module.exports = router;
