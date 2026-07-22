import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '../../.env') });

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  jwtSecret: process.env.JWT_SECRET || 'poc-demo-secret',
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
};
