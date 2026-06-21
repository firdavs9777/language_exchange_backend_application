const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  listPhrases,
  addPhrase,
  removePhrase
} = require('../controllers/chatPhrases');

router.use(protect);

router.get('/', listPhrases);
router.post('/', addPhrase);
router.delete('/', removePhrase);

module.exports = router;
