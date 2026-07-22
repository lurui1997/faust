import { Router } from 'express';
import { query, queryOne } from '../db.js';
import { authRequired, adminRequired } from '../middleware/auth.js';

const router = Router();

router.get('/', async (req, res) => {
  const { category, search } = req.query;
  let sql = 'SELECT id, name, description, price, stock, image_url, category FROM products WHERE stock > 0';
  const params = [];

  if (category) {
    sql += ' AND category = ?';
    params.push(category);
  }
  if (search) {
    sql += ' AND (name LIKE ? OR description LIKE ?)';
    params.push(`%${search}%`, `%${search}%`);
  }
  sql += ' ORDER BY id ASC';

  const products = await query(sql, params);
  res.json(products);
});

router.get('/categories', async (_req, res) => {
  const rows = await query(
    'SELECT DISTINCT category FROM products ORDER BY category',
  );
  res.json(rows.map((r) => r.category));
});

router.get('/:id', async (req, res) => {
  const product = await queryOne(
    'SELECT id, name, description, price, stock, image_url, category FROM products WHERE id = ?',
    [req.params.id],
  );
  if (!product) return res.status(404).json({ error: '商品不存在' });
  res.json(product);
});

router.post('/', authRequired, adminRequired, async (req, res) => {
  const { name, description, price, stock, image_url, category } = req.body;
  if (!name || price == null || stock == null) {
    return res.status(400).json({ error: '请填写商品名称、价格和库存' });
  }
  const result = await query(
    'INSERT INTO products (name, description, price, stock, image_url, category) VALUES (?, ?, ?, ?, ?, ?)',
    [name, description || '', price, stock, image_url || '', category || 'general'],
  );
  res.status(201).json({ id: result.insertId, name, price, stock });
});

router.put('/:id', authRequired, adminRequired, async (req, res) => {
  const { name, description, price, stock, image_url, category } = req.body;
  const existing = await queryOne('SELECT id FROM products WHERE id = ?', [req.params.id]);
  if (!existing) return res.status(404).json({ error: '商品不存在' });

  await query(
    `UPDATE products SET name = COALESCE(?, name), description = COALESCE(?, description),
     price = COALESCE(?, price), stock = COALESCE(?, stock),
     image_url = COALESCE(?, image_url), category = COALESCE(?, category) WHERE id = ?`,
    [name, description, price, stock, image_url, category, req.params.id],
  );
  res.json({ message: '更新成功' });
});

export default router;
