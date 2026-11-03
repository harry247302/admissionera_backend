
const express = require("express");
const blogRouters = express.Router();

const {
  createBlog,
  getBlogs,
  getBlogById,
  updateBlog,
  deleteBlog,
  createContentParagraph,
  getContentParagraphsByBlog,
  createBlogContentTable,
  getContentTablesByCourse,
} = require("../controllers/blogController");
const { createContentRow } = require("../controllers/specializationController");

blogRouters.post("/create", createBlog);
blogRouters.get("/get-by-id/:uuid", getBlogById);
blogRouters.put("/update/:uuid", updateBlog);
blogRouters.delete("/delete/:uuid", deleteBlog);
blogRouters.post("/add-paragraph",createContentParagraph)
blogRouters.get("fetch-paragraph/:id",getContentParagraphsByBlog)
blogRouters.post("/create-table",createBlogContentTable)
blogRouters.post("/create-rows",createContentRow)
blogRouters.get("/get-content-tables",getContentTablesByCourse)

blogRouters.get("/get", getBlogs);

module.exports = blogRouters     ;
