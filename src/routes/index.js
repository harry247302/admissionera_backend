const express = require('express');
const authRoutes = require('./authRoutes');
const userRoutes = require('./userRoutes');
const academicRouter = require('./academicRoutes');

const router = express.Router();

router.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/crm', require('./crmRoutes'));
router.use('/academic', academicRouter);
router.use('/session', require('./sessionRoutes'));

module.exports = router;
