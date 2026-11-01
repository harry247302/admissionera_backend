const express = require('express');
const authRoutes = require('./authRoutes');
const userRoutes = require('./userRoutes');
const academicRouter = require('./academicRoutes');
const counsellorRoutes = require('./counsellorRoutes');
// const blogsRouter = require('./approvalsRouter');
const approvalsRouter = require('./approvalsRouter');
const blogRouters = require('./blogsRouter');

const router = express.Router();

router.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/crm', require('./crmRoutes'));
router.use('/academic', academicRouter);
router.use('/counsellor', counsellorRoutes);
router.use('/session', require('./sessionRoutes'));
router.use('/approvals',approvalsRouter)
router.use('/blogs',blogRouters)


module.exports = router;
