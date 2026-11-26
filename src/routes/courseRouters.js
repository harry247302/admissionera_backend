const express = require("express");
const { fetchCoursesByUniversity } = require("../controllers/coursesController");
const courseRouters = express.Router();

// courseRouters.get('/courses', getCourses);
// courseRouters.get('/courses/:id', getCourseById);
// courseRouters.post('/courses', createCourse);
// courseRouters.put('/courses/:id', updateCourse);
courseRouters.get('/courses/:university_id', fetchCoursesByUniversity);

module.exports = courseRouters;