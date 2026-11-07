
const { pool } = require("../config/db");

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


const assertBlogExists = async (blogId) => {
  const result = await pool.query(
    "SELECT uuid FROM blogs WHERE uuid = $1",
    [blogId]
  );
  return result.rows[0] || null;
};

const createBlogContentTable = async (req, res) => {
  try {
    const {
      blog_id,
      title,
      sort_order = 0,
      counsellor_id = null,
    } = req.body;

    if (!blog_id) {
      return res.status(400).json({
        success: false,
        message: "blog_id is required",
      });
    }

    const blog = await assertBlogExists(blog_id);
    if (!blog) {
      return res.status(404).json({
        success: false,
        message: "Blog not found",
      });
    }

    const result = await pool.query(
      `
      INSERT INTO specialization_content_tables
        (blog_id, title, sort_order, counsellor_id)
      VALUES
        ($1, $2, $3, $4)
      RETURNING *
      `,
      [blog_id, title || null, Number(sort_order) || 0, counsellor_id || null]
    );

    return res.status(201).json({
      success: true,
      message: "Blog content table created successfully",
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Create blog content table error:", error);

    if (error.code === "22P02") {
      return res.status(400).json({
        success: false,
        message: "Invalid blog_id",
      });
    }

    if (error.code === "23503") {
      return res.status(400).json({
        success: false,
        message: "Invalid blog_id or counsellor_id",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to create blog content table",
      error: error.message,
    });
  }
};

const createContentRow = async (req, res) => {
  try {
    const {
      table_id,
      label,
      content = {},
      sort_order = 0,
      counsellor_id = null,
    } = req.body;

    if (!table_id) {
      return res.status(400).json({
        success: false,
        message: "table_id is required",
      });
    }

    if (!label) {
      return res.status(400).json({
        success: false,
        message: "label is required",
      });
    }

    const rowContent =
      content && typeof content === "object" && !Array.isArray(content)
        ? content
        : {};

    const result = await pool.query(
      `
      INSERT INTO specialization_content_rows
        (table_id, counsellor_id, label, content, sort_order)
      SELECT
        id,
        COALESCE($4::uuid, counsellor_id),
        $2,
        $3::jsonb,
        $5
      FROM specialization_content_tables
      WHERE id = $1
      RETURNING *
      `,
      [
        table_id,
        String(label),
        JSON.stringify(rowContent),
        counsellor_id || null,
        Number(sort_order) || 0,
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Content table not found",
      });
    }

    return res.status(201).json({
      success: true,
      message: "Content row created successfully",
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Create content row error:", error);

    if (error.code === "22P02") {
      return res.status(400).json({
        success: false,
        message: "Invalid table_id or counsellor_id",
      });
    }

    if (error.code === "23503") {
      return res.status(400).json({
        success: false,
        message: "Invalid table_id or counsellor_id",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to create content row",
      error: error.message,
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

// GET BLOG BY UUID (includes content tables + paragraphs)
const getBlogById = async (req, res) => {
  try {
    const { uuid } = req.params;

    const result = await pool.query(
      `
      SELECT
        b.*,
        COALESCE(p_data.content_paragraphs, '[]'::jsonb) AS content_paragraphs,
        COALESCE(t_data.content_tables, '[]'::jsonb) AS content_tables
      FROM blogs b
      LEFT JOIN LATERAL (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', p.id,
            'blog_id', p.blog_id,
            'title', p.title,
            'content', p.content,
            'sort_order', p.sort_order,
            'counsellor_id', p.counsellor_id,
            'created_at', p.created_at,
            'updated_at', p.updated_at
          )
          ORDER BY p.sort_order ASC, p.created_at ASC
        ) AS content_paragraphs
        FROM specialization_content_paragraphs p
        WHERE p.blog_id = b.uuid
      ) p_data ON true
      LEFT JOIN LATERAL (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', t.id,
            'blog_id', t.blog_id,
            'title', t.title,
            'sort_order', t.sort_order,
            'counsellor_id', t.counsellor_id,
            'created_at', t.created_at,
            'updated_at', t.updated_at,
            'rows', COALESCE(
              (
                SELECT jsonb_agg(
                  jsonb_build_object(
                    'id', r.id,
                    'table_id', r.table_id,
                    'label', r.label,
                    'content', r.content,
                    'sort_order', r.sort_order,
                    'counsellor_id', r.counsellor_id,
                    'created_at', r.created_at,
                    'updated_at', r.updated_at
                  )
                  ORDER BY r.sort_order ASC, r.created_at ASC
                )
                FROM specialization_content_rows r
                WHERE r.table_id = t.id
              ),
              '[]'::jsonb
            )
          )
          ORDER BY t.sort_order ASC, t.created_at ASC
        ) AS content_tables
        FROM specialization_content_tables t
        WHERE t.blog_id = b.uuid
      ) t_data ON true
      WHERE b.uuid = $1
      `,
      [uuid]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Blog not found",
      });
    }

    const blog = result.rows[0];
    const contentParagraphs = blog.content_paragraphs || [];
    const contentTables = blog.content_tables || [];

    return res.status(200).json({
      success: true,
      message: "Blog fetched successfully",
      data: {
        ...blog,
        content_paragraphs: contentParagraphs,
        content_tables: contentTables,
        contentParagraphs,
        contentTables,
      },
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


const getContentParagraphsByBlog = async (req, res) => {
  try {
    const blog_id = req.params.id || req.query.blog_id;

    if (!blog_id) {
      return res.status(400).json({
        success: false,
        message: "blog_id is required",
      });
    }

    const result = await pool.query(
      `
      SELECT *
      FROM specialization_content_paragraphs
      WHERE blog_id = $1
      ORDER BY sort_order ASC, created_at ASC
      `,
      [blog_id]
    );

    return res.status(200).json({
      success: true,
      count: result.rows.length,
      data: result.rows,
    });
  } catch (error) {
    console.error("Get content paragraphs error:", error);

    if (error.code === "22P02") {
      return res.status(400).json({
        success: false,
        message: "Invalid blog_id",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to fetch content paragraphs",
      error: error.message,
    });
  }
};

const createContentParagraph = async (req, res) => {
  try {
    const {
      blog_id,
      title,
      content,
      sort_order = 0,
      counsellor_id = null,
    } = req.body;

    if (!blog_id) {
      return res.status(400).json({
        success: false,
        message: "blog_id is required",
      });
    }

    if (!content || !String(content).trim()) {
      return res.status(400).json({
        success: false,
        message: "content is required",
      });
    }

    const blog = await assertBlogExists(blog_id);
    if (!blog) {
      return res.status(404).json({
        success: false,
        message: "Blog not found",
      });
    }

    const result = await pool.query(
      `
      INSERT INTO specialization_content_paragraphs
        (blog_id, title, content, sort_order, counsellor_id)
      VALUES
        ($1, $2, $3, $4, $5)
      RETURNING *
      `,
      [
        blog_id,
        title || null,
        String(content).trim(),
        Number(sort_order) || 0,
        counsellor_id || null,
      ]
    );

    return res.status(201).json({
      success: true,
      message: "Content paragraph created successfully",
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Create content paragraph error:", error);

    if (error.code === "22P02") {
      return res.status(400).json({
        success: false,
        message: "Invalid blog_id",
      });
    }

    if (error.code === "23503") {
      return res.status(400).json({
        success: false,
        message: "Invalid blog_id or counsellor_id",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to create content paragraph",
      error: error.message,
    });
  }
};

const getContentTablesByBlog = async (req, res) => {
  try {
    const blog_id =
      req.params.id || req.query.blog_id || req.body?.blog_id || null;

    if (!blog_id) {
      return res.status(400).json({
        success: false,
        message: "blog_id is required",
      });
    }

    const tablesResult = await pool.query(
      `
      SELECT *
      FROM specialization_content_tables
      WHERE blog_id = $1
      ORDER BY sort_order ASC, created_at ASC
      `,
      [blog_id]
    );

    const tables = [];
    for (const table of tablesResult.rows) {
      const rowsResult = await pool.query(
        `
        SELECT *
        FROM specialization_content_rows
        WHERE table_id = $1
        ORDER BY sort_order ASC, created_at ASC
        `,
        [table.id]
      );
      tables.push({
        ...table,
        rows: rowsResult.rows,
      });
    }

    return res.status(200).json({
      success: true,
      count: tables.length,
      data: tables,
    });
  } catch (error) {
    console.error("Get content tables error:", error);

    if (error.code === "22P02") {
      return res.status(400).json({
        success: false,
        message: "Invalid blog_id",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to fetch content tables",
      error: error.message,
    });
  }
};

module.exports = {
  createBlogContentTable,
  createBlog,
  getBlogs,
  createContentParagraph,
  getBlogById,
  getContentParagraphsByBlog,
  updateBlog,
  createContentRow,
  getContentTablesByBlog,
  getContentTablesByCourse: getContentTablesByBlog,
  deleteBlog,
};
