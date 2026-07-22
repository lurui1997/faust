import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import mysql from 'mysql2/promise';

const execFileAsync = promisify(execFile);
const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '../../.env') });

const config = {
  mysql: {
    host: process.env.MYSQL_HOST || '127.0.0.1',
    port: parseInt(process.env.MYSQL_PORT || '3308', 10),
    user: process.env.MYSQL_USER || 'ecommerce',
    password: process.env.MYSQL_PASSWORD || 'ecommerce123',
    database: process.env.MYSQL_DATABASE || 'ecommerce',
  },
  rocketmq: {
    nameServer: process.env.ROCKETMQ_NAMESRV || '127.0.0.1:19876',
    nameServerInternal: process.env.ROCKETMQ_NAMESRV_INTERNAL || 'localhost:9876',
    topic: process.env.ROCKETMQ_TOPIC || 'order-topic',
    dockerContainer: process.env.ROCKETMQ_DOCKER_CONTAINER || 'ecommerce-rocketmq',
    useDockerExec: process.env.ROCKETMQ_USE_DOCKER_EXEC !== 'false',
  },
  pollInterval: parseInt(process.env.WORKER_POLL_MS || '3000', 10),
};

let pool;

async function getPool() {
  if (!pool) {
    pool = mysql.createPool({ ...config.mysql, connectionLimit: 5 });
  }
  return pool;
}

async function processOrder(orderId) {
  const db = await getPool();
  const conn = await db.getConnection();

  try {
    await conn.beginTransaction();

    const [orders] = await conn.execute(
      'SELECT id, status FROM orders WHERE id = ? FOR UPDATE',
      [orderId],
    );
    if (!orders.length) {
      await conn.rollback();
      return false;
    }
    if (orders[0].status !== 'pending') {
      await conn.rollback();
      return false;
    }

    await conn.execute("UPDATE orders SET status = 'processing' WHERE id = ?", [orderId]);

    const [items] = await conn.execute(
      'SELECT product_id, quantity FROM order_items WHERE order_id = ?',
      [orderId],
    );

    for (const item of items) {
      const [result] = await conn.execute(
        'UPDATE products SET stock = stock - ? WHERE id = ? AND stock >= ?',
        [item.quantity, item.product_id, item.quantity],
      );
      if (result.affectedRows === 0) {
        await conn.execute("UPDATE orders SET status = 'failed' WHERE id = ?", [orderId]);
        await conn.commit();
        console.error(`[Worker] Order ${orderId} failed: insufficient stock`);
        return true;
      }
    }

    await conn.execute("UPDATE orders SET status = 'paid' WHERE id = ?", [orderId]);
    await conn.commit();
    console.log(`[Worker] Order ${orderId} → paid`);

    await new Promise((r) => setTimeout(r, 1500));
    await db.execute(
      "UPDATE orders SET status = 'shipped' WHERE id = ? AND status = 'paid'",
      [orderId],
    );
    console.log(`[Worker] Order ${orderId} → shipped`);
    return true;
  } catch (err) {
    await conn.rollback();
    console.error(`[Worker] Order ${orderId} error:`, err.message);
    return false;
  } finally {
    conn.release();
  }
}

async function pollPendingOrders() {
  const db = await getPool();
  const [rows] = await db.execute(
    "SELECT id FROM orders WHERE status = 'pending' ORDER BY created_at ASC LIMIT 10",
  );
  for (const row of rows) {
    await processOrder(row.id);
  }
}

async function consumeRocketMQ() {
  if (!config.rocketmq.useDockerExec) return;

  try {
    const { stdout } = await execFileAsync('docker', [
      'exec', config.rocketmq.dockerContainer, 'sh', 'mqadmin',
      'consumeMessage', '-n', config.rocketmq.nameServerInternal,
      '-t', config.rocketmq.topic, '-g', 'order-consumer-cli',
      '-n', '1', '-o', 'true',
    ], { timeout: 5000 });

    const match = stdout.match(/orderId["\s:]+(\d+)/);
    if (match) {
      console.log('[Worker] MQ message received for order', match[1]);
      await processOrder(parseInt(match[1], 10));
    }
  } catch {
    // consumeMessage returns non-zero when no messages — expected
  }
}

async function main() {
  await getPool();
  console.log('[Worker] MySQL connected');
  console.log(`[Worker] RocketMQ via ${config.rocketmq.dockerContainer} (topic: ${config.rocketmq.topic})`);
  console.log(`[Worker] Polling pending orders every ${config.pollInterval}ms`);

  setInterval(async () => {
    await consumeRocketMQ();
    await pollPendingOrders();
  }, config.pollInterval);

  await pollPendingOrders();
}

main().catch((err) => {
  console.error('[Worker] Failed:', err.message);
  process.exit(1);
});
