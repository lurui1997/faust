# E-Commerce POC

基于真实 MySQL 数据库和 RocketMQ 消息队列的网页版电商系统，用于 POC 演示。

## 功能

- 用户注册/登录（JWT）、管理员后台
- 商品浏览、分类筛选、搜索
- 购物车增删改、库存校验
- **异步下单**：结账后发送 RocketMQ 消息，Worker 消费处理（扣库存 → 支付 → 发货）
- 订单状态实时追踪

## 技术栈

| 组件 | 技术 |
| --- | --- |
| 后端 | Node.js + Express 5 |
| 数据库 | MySQL 8.0 |
| 消息队列 | Apache RocketMQ 4.9.7 |
| 前端 | 原生 HTML/CSS/JS |
| 基础设施 | Docker Compose |

## 架构

```text
浏览器 → Express API → MySQL
                ↓
         docker exec mqadmin sendMessage
                ↓
         RocketMQ Broker (真实队列)
                ↓
    Worker (consumeMessage + 轮询降级) → MySQL
```

Worker 通过 `docker exec mqadmin` 与真实 RocketMQ 交互；若 MQ 暂不可用，自动降级为轮询 `pending` 订单，确保演示不中断。

## 快速开始

```sh
cd projects/ecommerce-poc
cp .env.example .env

# 1. 启动 MySQL + RocketMQ
docker-compose up -d

# 2. 等待 RocketMQ 就绪（约 15 秒）
docker logs -f ecommerce-rocketmq   # 看到 "RocketMQ 4.9.7 ready" 即可

# 3. 安装依赖并启动
npm install
npm run dev      # 终端 1: API → http://localhost:3000
npm run worker   # 终端 2: 订单 Worker
```

**演示账号**：`admin` / `admin123`

## 演示流程

1. 登录后浏览商品，加入购物车
2. 结算并填写收货地址
3. 观察订单状态：`待处理` → `处理中` → `已支付` → `已发货`
4. Worker 终端可看到 RocketMQ 消息收发日志

## 停止

```sh
docker-compose down      # 保留数据
docker-compose down -v   # 清除数据
```

## Status

Building — created 2026-07-22.
