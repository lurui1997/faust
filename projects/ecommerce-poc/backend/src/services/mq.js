import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { config } from '../config.js';

const execFileAsync = promisify(execFile);

export async function sendOrderMessage(orderId) {
  const body = JSON.stringify({ orderId, timestamp: Date.now() });
  const cmd = config.rocketmq.useDockerExec
    ? ['exec', config.rocketmq.dockerContainer, 'sh', 'mqadmin', 'sendMessage',
        '-n', config.rocketmq.nameServerInternal,
        '-t', config.rocketmq.topic,
        '-p', body,
        '-k', `order-${orderId}`,
        '-c', 'ORDER_CREATED']
    : null;

  if (cmd) {
    try {
      const { stdout } = await execFileAsync('docker', cmd);
      console.log(`[MQ] Order ${orderId} sent via mqadmin:`, stdout.trim());
      return { msgId: `order-${orderId}` };
    } catch (err) {
      console.warn(`[MQ] mqadmin send failed: ${err.message}, worker will poll`);
    }
  }

  console.log(`[MQ] Order ${orderId} queued (pending worker poll)`);
  return { msgId: `pending-${orderId}` };
}

export async function shutdownProducer() {}
