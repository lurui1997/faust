import { Router } from 'express';
import { query, queryOne } from '../db.js';
import { authRequired, adminRequired } from '../middleware/auth.js';
import { sendOrderMessage } from '../services/mq.js';

const router = Router();

router.use(authRequired);

router.post('/checkout', async (req, res) => {
  const { shippingAddress } = req.body;
  if (!shippingAddress?.trim()) {
    return res.status(400).json({ error: '请填写收货地址' });
  }

  const cartItems = await query(
    `SELECT ci.product_id, ci.quantity, p.name, p.price, p.stock
     FROM cart_items ci
     JOIN products p ON ci.product_id = p.id
     WHERE ci.user_id = ?`,
    [req.user.id],
  );

  if (cartItems.length === 0) {
    return res.status(400).json({ error: '购物车为空' });
  }

  for (const item of cartItems) {
    if (item.stock < item.quantity) {
      return res.status(400).json({ error: `商品「${item.name}」库存不足` });
    }
  }

  const totalAmount = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const db = await import('../db.js');
  const pool = await db.getPool();
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    const [orderResult] = await conn.execute(
      'INSERT INTO orders (user_id, status, total_amount, shipping_address) VALUES (?, ?, ?, ?)',
      [req.user.id, 'pending', totalAmount, shippingAddress],
    );
    const orderId = orderResult.insertId;

    for (const item of cartItems) {
      await conn.execute(
        'INSERT INTO order_items (order_id, product_id, quantity, price) VALUES (?, ?, ?, ?)',
        [orderId, item.product_id, item.quantity, item.price],
      );
    }

    await conn.execute('DELETE FROM cart_items WHERE user_id = ?', [req.user.id]);
    await conn.commit();

    try {
      await sendOrderMessage(orderId);
    } catch (mqErr) {
      console.error('[MQ] Failed to send order message:', mqErr.message);
    }

    res.status(201).json({
      orderId,
      status: 'pending',
      totalAmount,
      message: '订单已创建，正在异步处理中',
    });
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
});

router.get('/', async (req, res) => {
  const orders = await query(
    `SELECT o.id, o.status, o.total_amount, o.shipping_address, o.created_at, o.updated_at
     FROM orders o
     WHERE o.user_id = ?
     ORDER BY o.created_at DESC`,
    [req.user.id],
  );
  res.json(orders);
});

router.get('/admin/all', adminRequired, async (_req, res) => {
  const orders = await query(
    `SELECT o.id, o.status, o.total_amount, o.shipping_address, o.created_at, o.updated_at,
            u.username
     FROM orders o
     JOIN users u ON o.user_id = u.id
     ORDER BY o.created_at DESC
     LIMIT 100`,
  );
  res.json(orders);
});

router.get('/:id', async (req, res) => {
  const order = await queryOne(
    `SELECT o.id, o.user_id, o.status, o.total_amount, o.shipping_address, o.created_at, o.updated_at
     FROM orders o WHERE o.id = ?`,
    [req.params.id],
  );
  if (!order) return res.status(404).json({ error: '订单不存在' });
  if (order.user_id !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({ error: '无权查看' });
  }

  const items = await query(
    `SELECT oi.quantity, oi.price, p.name, p.image_url
     FROM order_items oi
     JOIN products p ON oi.product_id = p.id
     WHERE oi.order_id = ?`,
    [order.id],
  );

  res.json({ ...order, items });
});

router.patch('/:id/status', adminRequired, async (req, res) => {
  const { status } = req.body;
  const validStatuses = ['pending', 'processing', 'paid', 'shipped', 'completed', 'cancelled', 'failed'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: '无效的状态' });
  }

  const result = await query(
    'UPDATE orders SET status = ? WHERE id = ?',
    [status, req.params.id],
  );
  if (result.affectedRows === 0) return res.status(404).json({ error: '订单不存在' });
  res.json({ message: '状态已更新' });
});

export default router;
