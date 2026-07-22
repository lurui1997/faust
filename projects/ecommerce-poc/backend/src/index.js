import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { config } from './config.js';
import { getPool } from './db.js';
import { shutdownProducer } from './services/mq.js';
import authRoutes from './routes/auth.js';
import productRoutes from './routes/products.js';
import cartRoutes from './routes/cart.js';
import orderRoutes from './routes/orders.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(join(__dirname, '../../frontend')));

app.get('/api/health', async (_req, res) => {
  try {
    const pool = await getPool();
    await pool.query('SELECT 1');
    res.json({ status: 'ok', mysql: 'connected' });
  } catch (err) {
    res.status(503).json({ status: 'error', mysql: err.message });
  }
});

app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/orders', orderRoutes);

app.use((_req, res) => {
  res.sendFile(join(__dirname, '../../frontend/index.html'));
});

async function start() {
  await getPool();
  console.log('[DB] MySQL connected');

  app.listen(config.port, () => {
    console.log(`[App] Server running at http://localhost:${config.port}`);
  });
}

process.on('SIGINT', async () => {
  await shutdownProducer();
  process.exit(0);
});

start().catch((err) => {
  console.error('Failed to start:', err);
  process.exit(1);
});
