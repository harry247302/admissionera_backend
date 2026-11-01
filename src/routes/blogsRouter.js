
const express = require("express");
const blogRouters = express.Router();

const {
  createBlog,
  getBlogs,
  getBlogById,
  updateBlog,
  deleteBlog,
  createContentParagraph,
} = require("../controllers/blogController");

blogRouters.post("/create", createBlog);
blogRouters.get("/get-by-id/:uuid", getBlogById);
blogRouters.put("/update/:uuid", updateBlog);
blogRouters.delete("/delete/:uuid", deleteBlog);
blogRouters.post("/add-paragraph",createContentParagraph)

blogRouters.get("/get", getBlogs);

module.exports = blogRouters     ;
