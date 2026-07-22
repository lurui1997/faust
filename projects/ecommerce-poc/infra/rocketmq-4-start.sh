#!/bin/sh
set -e

export JAVA_OPT_EXT="-Xms128m -Xmx256m -Xmn64m"

echo "Starting NameServer..."
cd /home/rocketmq/rocketmq-4.9.7/bin
sh mqnamesrv &
sleep 3

echo "Starting Broker..."
sh mqbroker -n localhost:9876 -c /home/rocketmq/rocketmq-4.9.7/conf/broker.conf &
sleep 5

echo "Creating topic order-topic..."
sh mqadmin updateTopic -n localhost:9876 -t order-topic -c DefaultCluster || true

echo "RocketMQ 4.9.7 ready"
wait
