import { demoApi } from './demo-api.js';

const STATUS_LABELS = {
  pending: '待处理', processing: '处理中', paid: '已支付',
  shipped: '已发货', completed: '已完成', cancelled: '已取消', failed: '失败',
};

let state = {
  user: null,
  token: localStorage.getItem('demo-token'),
  products: [],
  cart: { items: [], total: 0 },
  authMode: 'login',
};

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

async function api(path, options = {}) {
  return demoApi(path, options, state.token);
}

function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.remove('hidden');
  setTimeout(() => el.classList.add('hidden'), 2500);
}

function showPage(name) {
  $$('.page').forEach((p) => p.classList.remove('active'));
  $(`#page-${name}`)?.classList.add('active');
  $$('.nav-btn').forEach((b) => b.classList.toggle('active', b.dataset.page === name));
  if (name === 'shop') loadProducts();
  if (name === 'cart') loadCart();
  if (name === 'orders') loadOrders();
  if (name === 'admin') loadAdmin();
}

function updateAuthUI() {
  const area = $('#auth-area');
  if (state.user) {
    area.innerHTML = `<span>Hi, ${state.user.username}</span><button class="btn btn-sm" id="logout-btn">退出</button>`;
    $('#logout-btn').onclick = logout;
    $$('.admin-only').forEach((el) => el.classList.toggle('hidden', state.user.role !== 'admin'));
  } else {
    area.innerHTML = '<button class="btn btn-primary btn-sm" id="login-btn">登录</button>';
    $('#login-btn').onclick = () => openAuthModal();
    $$('.admin-only').forEach((el) => el.classList.add('hidden'));
  }
}

async function init() {
  if (state.token) {
    try { state.user = await api('/auth/me'); } catch { state.token = null; localStorage.removeItem('demo-token'); }
  }
  updateAuthUI();
  bindEvents();
  showPage('shop');
}

function bindEvents() {
  $$('.nav-btn, .logo').forEach((el) => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      const page = el.dataset.page;
      if (!page) return;
      if (page !== 'shop' && !state.user) { openAuthModal(); return; }
      showPage(page);
    });
  });
  $('#search-input').addEventListener('input', debounce(loadProducts, 300));
  $('#category-filter').addEventListener('change', loadProducts);
  $('#auth-form').addEventListener('submit', handleAuth);
  $('#auth-toggle').addEventListener('click', (e) => { e.preventDefault(); state.authMode = state.authMode === 'login' ? 'register' : 'login'; updateAuthModal(); });
  $('#checkout-form').addEventListener('submit', handleCheckout);
  $('#checkout-cancel').addEventListener('click', () => $('#checkout-modal').close());
  $$('.tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      $$('.tab-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      $$('.tab-panel').forEach((p) => p.classList.remove('active'));
      $(`#${btn.dataset.tab}`).classList.add('active');
    });
  });
}

function openAuthModal() { state.authMode = 'login'; updateAuthModal(); $('#auth-modal').showModal(); }
function updateAuthModal() {
  const isRegister = state.authMode === 'register';
  $('#auth-title').textContent = isRegister ? '注册' : '登录';
  $('#email-field').classList.toggle('hidden', !isRegister);
  $('#auth-toggle').textContent = isRegister ? '已有账号？登录' : '没有账号？注册';
  $('#auth-error').classList.add('hidden');
}

async function handleAuth(e) {
  e.preventDefault();
  const body = Object.fromEntries(new FormData(e.target));
  try {
    const endpoint = state.authMode === 'login' ? '/auth/login' : '/auth/register';
    const data = await api(endpoint, { method: 'POST', body: JSON.stringify(body) });
    state.token = data.token;
    state.user = data.user;
    localStorage.setItem('demo-token', data.token);
    $('#auth-modal').close();
    updateAuthUI();
    toast(state.authMode === 'login' ? '登录成功' : '注册成功');
    loadCart();
  } catch (err) {
    $('#auth-error').textContent = err.message;
    $('#auth-error').classList.remove('hidden');
  }
}

function logout() {
  state.user = null; state.token = null;
  localStorage.removeItem('demo-token');
  updateAuthUI(); showPage('shop'); toast('已退出');
}

async function loadProducts() {
  const search = $('#search-input').value;
  const category = $('#category-filter').value;
  const params = new URLSearchParams();
  if (search) params.set('search', search);
  if (category) params.set('category', category);
  state.products = await api(`/products?${params}`);
  renderProducts();
  const categories = await api('/products/categories');
  const select = $('#category-filter');
  const current = select.value;
  select.innerHTML = '<option value="">全部分类</option>' + categories.map((c) => `<option value="${c}">${c}</option>`).join('');
  select.value = current;
}

function renderProducts() {
  const grid = $('#product-grid');
  if (!state.products.length) { grid.innerHTML = '<p class="empty-state">暂无商品</p>'; return; }
  grid.innerHTML = state.products.map((p) => `
    <div class="product-card">
      <img class="product-img" src="${p.image_url}" alt="${p.name}" loading="lazy">
      <div class="product-body">
        <div class="product-category">${p.category}</div>
        <div class="product-name">${p.name}</div>
        <div class="product-desc">${p.description || ''}</div>
        <div class="product-footer">
          <div><div class="product-price">${Number(p.price).toFixed(2)}</div><div class="product-stock">库存 ${p.stock}</div></div>
          <button class="btn btn-primary btn-sm" data-add="${p.id}">加入购物车</button>
        </div>
      </div>
    </div>`).join('');
  grid.querySelectorAll('[data-add]').forEach((btn) => btn.addEventListener('click', () => addToCart(btn.dataset.add)));
}

async function addToCart(productId) {
  if (!state.user) return openAuthModal();
  await api('/cart', { method: 'POST', body: JSON.stringify({ productId, quantity: 1 }) });
  toast('已加入购物车'); loadCart();
}

async function loadCart() {
  if (!state.user) return;
  state.cart = await api('/cart');
  updateCartBadge(); renderCart();
}

function updateCartBadge() {
  const count = state.cart.items.reduce((s, i) => s + i.quantity, 0);
  $('#cart-badge').textContent = count;
  $('#cart-badge').classList.toggle('hidden', count === 0);
}

function renderCart() {
  const el = $('#cart-content');
  if (!state.cart.items.length) { el.innerHTML = '<p class="empty-state">购物车是空的</p>'; return; }
  el.innerHTML = state.cart.items.map((item) => `
    <div class="cart-item">
      <img src="${item.image_url}" alt="${item.name}">
      <div class="cart-item-info"><div class="cart-item-name">${item.name}</div><div class="cart-item-price">¥${Number(item.price).toFixed(2)}</div></div>
      <div class="qty-control"><button data-qty-dec="${item.id}">−</button><span>${item.quantity}</span><button data-qty-inc="${item.id}">+</button></div>
      <button class="btn btn-sm btn-danger" data-remove="${item.id}">删除</button>
    </div>`).join('') + `<div class="cart-footer"><div class="cart-total">合计: <span>¥${state.cart.total.toFixed(2)}</span></div><button class="btn btn-primary" id="checkout-btn">去结算</button></div>`;
  el.querySelector('#checkout-btn').onclick = openCheckout;
  el.querySelectorAll('[data-remove]').forEach((b) => b.onclick = () => removeCartItem(b.dataset.remove));
  el.querySelectorAll('[data-qty-inc]').forEach((b) => b.onclick = () => updateQty(b.dataset.qtyInc, 1));
  el.querySelectorAll('[data-qty-dec]').forEach((b) => b.onclick = () => updateQty(b.dataset.qtyDec, -1));
}

async function updateQty(id, delta) {
  const item = state.cart.items.find((i) => i.id == id);
  if (!item) return;
  const newQty = item.quantity + delta;
  if (newQty < 1) return removeCartItem(id);
  await api(`/cart/${id}`, { method: 'PUT', body: JSON.stringify({ quantity: newQty }) });
  loadCart();
}

async function removeCartItem(id) { await api(`/cart/${id}`, { method: 'DELETE' }); loadCart(); toast('已移除'); }

function openCheckout() {
  $('#checkout-summary').innerHTML = `<p>共 ${state.cart.items.length} 件商品</p><p><strong>合计: ¥${state.cart.total.toFixed(2)}</strong></p>
    <p style="margin-top:0.5rem;font-size:0.8rem;color:#6b6b6b">GitHub Pages 静态演示：模拟 RocketMQ 异步处理（约 4 秒完成状态流转）</p>`;
  $('#checkout-error').classList.add('hidden');
  $('#checkout-modal').showModal();
}

async function handleCheckout(e) {
  e.preventDefault();
  const fd = new FormData(e.target);
  const data = await api('/orders/checkout', { method: 'POST', body: JSON.stringify({ shippingAddress: fd.get('shippingAddress') }) });
  $('#checkout-modal').close();
  toast(`订单 #${data.orderId} 已创建，异步处理中...`);
  loadCart(); showPage('orders');
}

async function loadOrders() {
  const el = $('#orders-list');
  const orders = await api('/orders');
  if (!orders.length) { el.innerHTML = '<p class="empty-state">暂无订单</p>'; return; }
  el.innerHTML = orders.map(renderOrderCard).join('');
  startOrderPolling();
}

function renderOrderCard(o) {
  return `<div class="order-card"><div class="order-header"><span class="order-id">订单 #${o.id}</span>
    <span class="status-badge status-${o.status}">${STATUS_LABELS[o.status] || o.status}</span></div>
    <div class="order-meta"><p>金额: ¥${Number(o.total_amount).toFixed(2)}</p><p>地址: ${o.shipping_address}</p>
    <p>下单: ${new Date(o.created_at).toLocaleString('zh-CN')}</p></div></div>`;
}

let pollTimer;
function startOrderPolling() {
  clearInterval(pollTimer);
  pollTimer = setInterval(async () => {
    if ($('#page-orders').classList.contains('active')) {
      const orders = await api('/orders');
      $('#orders-list').innerHTML = orders.length ? orders.map(renderOrderCard).join('') : '<p class="empty-state">暂无订单</p>';
      if (!orders.some((o) => ['pending', 'processing'].includes(o.status))) clearInterval(pollTimer);
    }
  }, 1000);
}

async function loadAdmin() {
  const orders = await api('/orders/admin/all');
  $('#admin-orders').innerHTML = `<table class="admin-table"><thead><tr><th>订单号</th><th>用户</th><th>金额</th><th>状态</th><th>时间</th></tr></thead>
    <tbody>${orders.map((o) => `<tr><td>#${o.id}</td><td>${o.username}</td><td>¥${Number(o.total_amount).toFixed(2)}</td>
    <td><span class="status-badge status-${o.status}">${STATUS_LABELS[o.status]}</span></td>
    <td>${new Date(o.created_at).toLocaleString('zh-CN')}</td></tr>`).join('')}</tbody></table>`;
  const products = await api('/products');
  $('#admin-products').innerHTML = `<table class="admin-table"><thead><tr><th>ID</th><th>名称</th><th>价格</th><th>库存</th><th>分类</th></tr></thead>
    <tbody>${products.map((p) => `<tr><td>${p.id}</td><td>${p.name}</td><td>¥${Number(p.price).toFixed(2)}</td><td>${p.stock}</td><td>${p.category}</td></tr>`).join('')}</tbody></table>`;
}

function debounce(fn, ms) {
  let timer;
  return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), ms); };
}

init();
