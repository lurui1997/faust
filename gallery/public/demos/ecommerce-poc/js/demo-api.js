const PRODUCTS = [
  { id: 1, name: '无线蓝牙耳机', description: '主动降噪，续航 30 小时，支持快充', price: 299, stock: 100, image_url: 'https://picsum.photos/seed/headphone/400/400', category: 'electronics' },
  { id: 2, name: '机械键盘', description: '青轴机械键盘，RGB 背光，87 键紧凑布局', price: 459, stock: 50, image_url: 'https://picsum.photos/seed/keyboard/400/400', category: 'electronics' },
  { id: 3, name: '运动水杯', description: '750ml 不锈钢保温杯，24 小时保冷', price: 89, stock: 200, image_url: 'https://picsum.photos/seed/bottle/400/400', category: 'lifestyle' },
  { id: 4, name: '编程书籍', description: '《深入理解计算机系统》第三版', price: 139, stock: 80, image_url: 'https://picsum.photos/seed/book/400/400', category: 'books' },
  { id: 5, name: '智能手表', description: '健康监测、GPS 定位、7 天续航', price: 1299, stock: 30, image_url: 'https://picsum.photos/seed/watch/400/400', category: 'electronics' },
  { id: 6, name: '帆布背包', description: '大容量双肩包，防水面料，适合通勤', price: 199, stock: 120, image_url: 'https://picsum.photos/seed/bottle/400/400', category: 'lifestyle' },
  { id: 7, name: 'USB-C 扩展坞', description: '7 合 1 扩展坞，支持 4K 输出', price: 249, stock: 60, image_url: 'https://picsum.photos/seed/dock/400/400', category: 'electronics' },
  { id: 8, name: '咖啡豆', description: '埃塞俄比亚耶加雪菲，中度烘焙 250g', price: 68, stock: 150, image_url: 'https://picsum.photos/seed/coffee/400/400', category: 'food' },
];

const db = {
  users: [{ id: 1, username: 'admin', email: 'admin@demo.com', password: 'admin123', role: 'admin' }],
  carts: {},
  orders: [],
  nextOrderId: 1,
  nextCartId: 1,
  sessions: {},
};

function parseBody(options) {
  if (!options.body) return {};
  return JSON.parse(options.body);
}

function getUser(token) {
  const userId = db.sessions[token];
  return db.users.find((u) => u.id === userId) || null;
}

function simulateOrderFlow(orderId) {
  const order = db.orders.find((o) => o.id === orderId);
  if (!order || order.status !== 'pending') return;

  setTimeout(() => { order.status = 'processing'; }, 800);
  setTimeout(() => {
    order.status = 'paid';
    for (const item of order.items) {
      const p = PRODUCTS.find((x) => x.id === item.product_id);
      if (p) p.stock -= item.quantity;
    }
  }, 2000);
  setTimeout(() => { order.status = 'shipped'; }, 4000);
}

export async function demoApi(path, options = {}, token) {
  await new Promise((r) => setTimeout(r, 120));
  const user = token ? getUser(token) : null;
  const method = options.method || 'GET';
  const body = parseBody(options);

  if (path.startsWith('/auth/login') && method === 'POST') {
    const u = db.users.find((x) => x.username === body.username && x.password === body.password);
    if (!u) throw new Error('用户名或密码错误');
    const t = `demo-${u.id}-${Date.now()}`;
    db.sessions[t] = u.id;
    return { token: t, user: { id: u.id, username: u.username, email: u.email, role: u.role } };
  }

  if (path.startsWith('/auth/register') && method === 'POST') {
    if (db.users.some((u) => u.username === body.username)) throw new Error('用户名已存在');
    const u = { id: db.users.length + 1, username: body.username, email: body.email, password: body.password, role: 'user' };
    db.users.push(u);
    const t = `demo-${u.id}-${Date.now()}`;
    db.sessions[t] = u.id;
    return { token: t, user: { id: u.id, username: u.username, email: u.email, role: u.role } };
  }

  if (path.startsWith('/auth/me')) {
    if (!user) throw new Error('未登录');
    return { id: user.id, username: user.username, email: user.email, role: user.role };
  }

  if (path.startsWith('/products/categories')) {
    return [...new Set(PRODUCTS.map((p) => p.category))].sort();
  }

  if (path.startsWith('/products')) {
    const params = new URLSearchParams(path.split('?')[1] || '');
    let list = PRODUCTS.filter((p) => p.stock > 0);
    const cat = params.get('category');
    const search = params.get('search');
    if (cat) list = list.filter((p) => p.category === cat);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((p) => p.name.toLowerCase().includes(q) || (p.description || '').toLowerCase().includes(q));
    }
    return list;
  }

  if (!user) throw new Error('未登录');

  if (path.startsWith('/cart') && method === 'GET') {
    const items = (db.carts[user.id] || []).map((ci) => {
      const p = PRODUCTS.find((x) => x.id === ci.product_id);
      return { id: ci.id, quantity: ci.quantity, product_id: p.id, name: p.name, price: p.price, stock: p.stock, image_url: p.image_url };
    });
    const total = items.reduce((s, i) => s + i.price * i.quantity, 0);
    return { items, total: Math.round(total * 100) / 100 };
  }

  if (path === '/cart' && method === 'POST') {
    if (!db.carts[user.id]) db.carts[user.id] = [];
    const productId = Number(body.productId);
    const quantity = Number(body.quantity) || 1;
    const p = PRODUCTS.find((x) => x.id === productId);
    if (!p || p.stock < quantity) throw new Error('库存不足');
    const existing = db.carts[user.id].find((c) => c.product_id === productId);
    if (existing) existing.quantity += quantity;
    else db.carts[user.id].push({ id: db.nextCartId++, product_id: productId, quantity });
    return { message: '已加入购物车' };
  }

  const cartMatch = path.match(/^\/cart\/(\d+)$/);
  if (cartMatch && method === 'PUT') {
    const ci = (db.carts[user.id] || []).find((c) => c.id === Number(cartMatch[1]));
    if (!ci) throw new Error('购物车项不存在');
    ci.quantity = body.quantity;
    return { message: '已更新' };
  }
  if (cartMatch && method === 'DELETE') {
    db.carts[user.id] = (db.carts[user.id] || []).filter((c) => c.id !== Number(cartMatch[1]));
    return { message: '已移除' };
  }

  if (path === '/orders/checkout' && method === 'POST') {
    const cart = db.carts[user.id] || [];
    if (!cart.length) throw new Error('购物车为空');
    const items = cart.map((ci) => {
      const p = PRODUCTS.find((x) => x.id === ci.product_id);
      return { product_id: p.id, quantity: ci.quantity, price: p.price, name: p.name };
    });
    const total = items.reduce((s, i) => s + i.price * i.quantity, 0);
    const order = {
      id: db.nextOrderId++,
      user_id: user.id,
      status: 'pending',
      total_amount: total,
      shipping_address: body.shippingAddress,
      created_at: new Date().toISOString(),
      items,
      username: user.username,
    };
    db.orders.unshift(order);
    db.carts[user.id] = [];
    simulateOrderFlow(order.id);
    return { orderId: order.id, status: 'pending', totalAmount: total, message: '订单已创建（模拟 RocketMQ 异步处理）' };
  }

  if (path === '/orders/admin/all') {
    if (user.role !== 'admin') throw new Error('需要管理员权限');
    return db.orders.map((o) => ({ ...o, username: db.users.find((u) => u.id === o.user_id)?.username || 'user' }));
  }

  if (path === '/orders' && method === 'GET') {
    return db.orders.filter((o) => o.user_id === user.id).map(({ items, username, ...o }) => o);
  }

  const orderMatch = path.match(/^\/orders\/(\d+)\/status$/);
  if (orderMatch && method === 'PATCH') {
    if (user.role !== 'admin') throw new Error('需要管理员权限');
    const o = db.orders.find((x) => x.id === Number(orderMatch[1]));
    if (!o) throw new Error('订单不存在');
    o.status = body.status;
    return { message: '状态已更新' };
  }

  throw new Error(`未知接口: ${method} ${path}`);
}
