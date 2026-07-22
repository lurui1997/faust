import { Router } from 'express';
import { query, queryOne } from '../db.js';
import { authRequired } from '../middleware/auth.js';

const router = Router();

router.use(authRequired);

router.get('/', async (req, res) => {
  const items = await query(
    `SELECT ci.id, ci.quantity, p.id AS product_id, p.name, p.price, p.stock, p.image_url
     FROM cart_items ci
     JOIN products p ON ci.product_id = p.id
     WHERE ci.user_id = ?
     ORDER BY ci.created_at DESC`,
    [req.user.id],
  );
  const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  res.json({ items, total: Math.round(total * 100) / 100 });
});

router.post('/', async (req, res) => {
  const { productId, quantity = 1 } = req.body;
  if (!productId || quantity < 1) {
    return res.status(400).json({ error: '无效的商品或数量' });
  }

  const product = await queryOne('SELECT id, stock FROM products WHERE id = ?', [productId]);
  if (!product) return res.status(404).json({ error: '商品不存在' });
  if (product.stock < quantity) return res.status(400).json({ error: '库存不足' });

  const existing = await queryOne(
    'SELECT id, quantity FROM cart_items WHERE user_id = ? AND product_id = ?',
    [req.user.id, productId],
  );

  if (existing) {
    const newQty = existing.quantity + quantity;
    if (product.stock < newQty) return res.status(400).json({ error: '库存不足' });
    await query('UPDATE cart_items SET quantity = ? WHERE id = ?', [newQty, existing.id]);
  } else {
    await query(
      'INSERT INTO cart_items (user_id, product_id, quantity) VALUES (?, ?, ?)',
      [req.user.id, productId, quantity],
    );
  }
  res.json({ message: '已加入购物车' });
});

router.put('/:id', async (req, res) => {
  const { quantity } = req.body;
  if (!quantity || quantity < 1) {
    return res.status(400).json({ error: '数量必须大于 0' });
  }

  const item = await queryOne(
    `SELECT ci.id, p.stock FROM cart_items ci
     JOIN products p ON ci.product_id = p.id
     WHERE ci.id = ? AND ci.user_id = ?`,
    [req.params.id, req.user.id],
  );
  if (!item) return res.status(404).json({ error: '购物车项不存在' });
  if (item.stock < quantity) return res.status(400).json({ error: '库存不足' });

  await query('UPDATE cart_items SET quantity = ? WHERE id = ?', [quantity, req.params.id]);
  res.json({ message: '已更新' });
});

router.delete('/:id', async (req, res) => {
  const result = await query(
    'DELETE FROM cart_items WHERE id = ? AND user_id = ?',
    [req.params.id, req.user.id],
  );
  if (result.affectedRows === 0) return res.status(404).json({ error: '购物车项不存在' });
  res.json({ message: '已移除' });
});

router.delete('/', async (req, res) => {
  await query('DELETE FROM cart_items WHERE user_id = ?', [req.user.id]);
  res.json({ message: '购物车已清空' });
});

export default router;
