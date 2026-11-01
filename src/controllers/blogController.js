
const pool = require("../config/db");

// CREATE BLOG
const createBlog = async (req, res) => {
  try {
    const {
      title,
      slug,
      excerpt,
      featured_image,
      author_id,
      category,
      tags,
      status,
      meta_title,
      meta_description,
      meta_keywords,
      published_at,
    } = req.body;

    if (!title || !slug) {
      return res.status(400).json({
        success: false,
        message: "Title and slug are required",
      });
    }

    const query = `
      INSERT INTO blogs (
        title, slug, excerpt, featured_image, author_id,
        category, tags, status, meta_title, meta_description,
        meta_keywords, published_at
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12
      )
      RETURNING *
    `;

    const values = [
      title,
      slug,
      excerpt ?? null,
      featured_image ?? null,
      author_id ?? null,
      category ?? null,
      tags ?? [],
      status ?? "draft",
      meta_title ?? null,
      meta_description ?? null,
      meta_keywords ?? [],
      published_at ?? null,
    ];

    const result = await pool.query(query, values);

    return res.status(201).json({
      success: true,
      message: "Blog created successfully",
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Create blog error:", error);

    if (error.code === "23505") {
      return res.status(409).json({
        success: false,
        message: "A blog with this slug already exists",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to create blog",
    });
  }
};

// GET ALL BLOGS
const getBlogs = async (req, res) => {
  try {
    const {
      status,
      category,
      search,
      page = 1,
      limit = 10,
    } = req.query;

    const pageNumber = Math.max(1, parseInt(page, 10) || 1);
    const limitNumber = Math.min(
      100,
      Math.max(1, parseInt(limit, 10) || 10)
    );
    const offset = (pageNumber - 1) * limitNumber;

    const conditions = [];
    const values = [];

    if (status) {
      values.push(status);
      conditions.push(`status = $${values.length}`);
    }

    if (category) {
      values.push(category);
      conditions.push(`category = $${values.length}`);
    }

    if (search) {
      values.push(`%${search}%`);
      conditions.push(
        `(title ILIKE $${values.length} OR excerpt ILIKE $${values.length})`
      );
    }

    const whereClause = conditions.length
      ? `WHERE ${conditions.join(" AND ")}`
      : "";

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM blogs ${whereClause}`,
      values
    );

    const total = Number(countResult.rows[0].count);

    const dataValues = [...values, limitNumber, offset];

    const query = `
      SELECT *
      FROM blogs
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${dataValues.length - 1}
      OFFSET $${dataValues.length}
    `;

    const result = await pool.query(query, dataValues);

    return res.status(200).json({
      success: true,
      message: "Blogs fetched successfully",
      data: result.rows,
      pagination: {
        total,
        page: pageNumber,
        limit: limitNumber,
        totalPages: Math.ceil(total / limitNumber),
      },
    });
  } catch (error) {
    console.error("Get blogs error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch blogs",
    });
  }
};

// GET BLOG BY UUID
const getBlogById = async (req, res) => {
  try {
    const { uuid } = req.params;

    const result = await pool.query(
      "SELECT * FROM blogs WHERE uuid = $1",
      [uuid]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Blog not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Blog fetched successfully",
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Get blog error:", error);

    if (error.code === "22P02") {
      return res.status(400).json({
        success: false,
        message: "Invalid blog UUID",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to fetch blog",
    });
  }
};

// UPDATE BLOG (PUT)
const updateBlog = async (req, res) => {
  try {
    const { uuid } = req.params;

    const allowedFields = {
      title: "title",
      slug: "slug",
      excerpt: "excerpt",
      featured_image: "featured_image",
      author_id: "author_id",
      category: "category",
      tags: "tags",
      status: "status",
      meta_title: "meta_title",
      meta_description: "meta_description",
      meta_keywords: "meta_keywords",
      published_at: "published_at",
    };

    const updates = [];
    const values = [];

    for (const [key, column] of Object.entries(allowedFields)) {
      if (Object.prototype.hasOwnProperty.call(req.body, key)) {
        values.push(req.body[key]);
        updates.push(`${column} = $${values.length}`);
      }
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Provide at least one valid field to update",
      });
    }

    updates.push("updated_at = NOW()");
    values.push(uuid);

    const query = `
      UPDATE blogs
      SET ${updates.join(", ")}
      WHERE uuid = $${values.length}
      RETURNING *
    `;

    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Blog not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Blog updated successfully",
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Update blog error:", error);

    if (error.code === "23505") {
      return res.status(409).json({
        success: false,
        message: "A blog with this slug already exists",
      });
    }

    if (error.code === "22P02") {
      return res.status(400).json({
        success: false,
        message: "Invalid UUID or field value",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to update blog",
    });
  }
};

// DELETE BLOG
const deleteBlog = async (req, res) => {
  try {
    const { uuid } = req.params;

    const result = await pool.query(
      "DELETE FROM blogs WHERE uuid = $1 RETURNING *",
      [uuid]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Blog not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Blog deleted successfully",
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Delete blog error:", error);

    if (error.code === "22P02") {
      return res.status(400).json({
        success: false,
        message: "Invalid blog UUID",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to delete blog",
    });
  }
};




const createContentParagraph = async (req, res) => {
  try {
      const {
          blog_id,
          title,
          content,
          sort_order = 0
      } = req.body;

      if (!blog_id) {
          return res.status(400).json({
              success: false,
              message: "blog_id is required"
          });
      }

      if (!content) {
          return res.status(400).json({
              success: false,
              message: "content is required"
          });
      }

      const result = await pool.query(
          `
          INSERT INTO course_content_paragraphs
              (blog_id, title, content, sort_order)
          VALUES
              ($1, $2, $3, $4)
          RETURNING *
          `,
          [
              blog_id,
              title || null,
              content,
              Number(sort_order) || 0
          ]
      );

      res.status(201).json({
          success: true,
          message: "Content paragraph created successfully",
          data: result.rows[0]
      });

  } catch (error) {
      console.error("Create content paragraph error:", error);

      res.status(500).json({
          success: false,
          message: "Failed to create content paragraph",
          error: error.message
      });
  }
};
module.exports = {
  createBlog,
  getBlogs,
  createContentParagraph,
  getBlogById,
  updateBlog,
  deleteBlog,
};
