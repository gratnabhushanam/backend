const express = require('express');
const router = express.Router();
const slokaController = require('../controllers/slokaController');

router.get('/', slokaController.getSlokas);
router.get('/daily', slokaController.getDailySloka);
router.get('/daily/history', slokaController.getDailyHistory);
router.post('/daily/history', slokaController.addDailyHistory);
router.get('/mentor', slokaController.getMentorSloka);
router.get('/mentor/content', slokaController.getMentorContent);
router.get('/mentor/history', slokaController.getMentorHistory);
router.post('/mentor/history', slokaController.addMentorHistory);
router.get('/:id', slokaController.getSlokaById);
router.post('/', slokaController.addSloka);

module.exports = router;
