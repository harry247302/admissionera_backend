const express = require('express');
const sessionController = require('../controllers/sessionController');

const sessionRouter = express.Router();

sessionRouter.post('/create', sessionController.createSession);
sessionRouter.get('/', sessionController.getSessions);
sessionRouter.get('/list', sessionController.getSessions);
// sessionRouter.get('/get/:id', sessionController.getSession);
// sessionRouter.put('/update/:id', sessionController.updateSession);
// sessionRouter.delete('/status/:id', sessionController.sessionStatus);

module.exports = sessionRouter;
