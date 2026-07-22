CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(50) NOT NULL UNIQUE,
  email VARCHAR(100) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('user', 'admin') DEFAULT 'user',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS products (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  description TEXT,
  price DECIMAL(10, 2) NOT NULL,
  stock INT NOT NULL DEFAULT 0,
  image_url VARCHAR(500),
  category VARCHAR(50) DEFAULT 'general',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS cart_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  product_id INT NOT NULL,
  quantity INT NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_user_product (user_id, product_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS orders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  status ENUM('pending', 'processing', 'paid', 'shipped', 'completed', 'cancelled', 'failed') DEFAULT 'pending',
  total_amount DECIMAL(10, 2) NOT NULL,
  shipping_address VARCHAR(500),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS order_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_id INT NOT NULL,
  product_id INT NOT NULL,
  quantity INT NOT NULL,
  price DECIMAL(10, 2) NOT NULL,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id)
);

-- Seed admin user (password: admin123)
INSERT INTO users (username, email, password_hash, role) VALUES
  ('admin', 'admin@demo.com', '$2b$10$yJvhweYoVEEHJNqUd2G/M.2.2/oVwbGAJU1h5iJ/6DzV4tg8qTD1C', 'admin');

INSERT INTO products (name, description, price, stock, image_url, category) VALUES
  ('无线蓝牙耳机', '主动降噪，续航 30 小时，支持快充', 299.00, 100, 'https://picsum.photos/seed/headphone/400/400', 'electronics'),
  ('机械键盘', '青轴机械键盘，RGB 背光，87 键紧凑布局', 459.00, 50, 'https://picsum.photos/seed/keyboard/400/400', 'electronics'),
  ('运动水杯', '750ml 不锈钢保温杯，24 小时保冷', 89.00, 200, 'https://picsum.photos/seed/bottle/400/400', 'lifestyle'),
  ('编程书籍', '《深入理解计算机系统》第三版', 139.00, 80, 'https://picsum.photos/seed/book/400/400', 'books'),
  ('智能手表', '健康监测、GPS 定位、7 天续航', 1299.00, 30, 'https://picsum.photos/seed/watch/400/400', 'electronics'),
  ('帆布背包', '大容量双肩包，防水面料，适合通勤', 199.00, 120, 'https://picsum.photos/seed/backpack/400/400', 'lifestyle'),
  ('USB-C 扩展坞', '7 合 1 扩展坞，支持 4K 输出', 249.00, 60, 'https://picsum.photos/seed/dock/400/400', 'electronics'),
  ('咖啡豆', '埃塞俄比亚耶加雪菲，中度烘焙 250g', 68.00, 150, 'https://picsum.photos/seed/coffee/400/400', 'food');
