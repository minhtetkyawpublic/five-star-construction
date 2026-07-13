CREATE DATABASE IF NOT EXISTS five_star_construction
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE five_star_construction;

CREATE TABLE IF NOT EXISTS users (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  phone VARCHAR(50) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('owner', 'site_incharge') NOT NULL,
  status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY users_phone_unique (phone),
  KEY users_role_index (role),
  KEY users_status_index (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS auth_tokens (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  token_hash CHAR(64) NOT NULL,
  expires_at DATETIME NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  revoked_at DATETIME NULL,
  UNIQUE KEY auth_tokens_token_hash_unique (token_hash),
  KEY auth_tokens_user_id_index (user_id),
  KEY auth_tokens_expires_at_index (expires_at),
  CONSTRAINT auth_tokens_user_id_foreign
    FOREIGN KEY (user_id) REFERENCES users (id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sites (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(160) NOT NULL,
  location VARCHAR(255) NOT NULL DEFAULT '',
  status ENUM('active', 'inactive', 'completed') NOT NULL DEFAULT 'active',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY sites_status_index (status),
  KEY sites_name_index (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE sites
  MODIFY status ENUM('active', 'inactive', 'completed') NOT NULL DEFAULT 'active';

CREATE TABLE IF NOT EXISTS site_users (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  site_id INT UNSIGNED NOT NULL,
  user_id INT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY site_users_site_user_unique (site_id, user_id),
  KEY site_users_user_id_index (user_id),
  CONSTRAINT site_users_site_id_foreign
    FOREIGN KEY (site_id) REFERENCES sites (id)
    ON DELETE CASCADE,
  CONSTRAINT site_users_user_id_foreign
    FOREIGN KEY (user_id) REFERENCES users (id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS workers (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(160) NOT NULL,
  phone VARCHAR(50) NOT NULL DEFAULT '',
  daily_wage DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY workers_status_index (status),
  KEY workers_name_index (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS worker_sites (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  worker_id INT UNSIGNED NOT NULL,
  site_id INT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY worker_sites_worker_site_unique (worker_id, site_id),
  KEY worker_sites_site_id_index (site_id),
  CONSTRAINT worker_sites_worker_id_foreign
    FOREIGN KEY (worker_id) REFERENCES workers (id)
    ON DELETE CASCADE,
  CONSTRAINT worker_sites_site_id_foreign
    FOREIGN KEY (site_id) REFERENCES sites (id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS daily_reports (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  site_id INT UNSIGNED NOT NULL,
  report_date DATE NOT NULL,
  submitted_by INT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY daily_reports_site_date_unique (site_id, report_date),
  KEY daily_reports_report_date_index (report_date),
  KEY daily_reports_submitted_by_index (submitted_by),
  CONSTRAINT daily_reports_site_id_foreign
    FOREIGN KEY (site_id) REFERENCES sites (id)
    ON DELETE CASCADE,
  CONSTRAINT daily_reports_submitted_by_foreign
    FOREIGN KEY (submitted_by) REFERENCES users (id)
    ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS attendance (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  daily_report_id BIGINT UNSIGNED NOT NULL,
  site_id INT UNSIGNED NOT NULL,
  worker_id INT UNSIGNED NOT NULL,
  date DATE NOT NULL,
  status ENUM('present', 'absent', 'half_day') NOT NULL,
  wage_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  note TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY attendance_report_worker_unique (daily_report_id, worker_id),
  KEY attendance_site_date_index (site_id, date),
  KEY attendance_worker_id_index (worker_id),
  CONSTRAINT attendance_daily_report_id_foreign
    FOREIGN KEY (daily_report_id) REFERENCES daily_reports (id)
    ON DELETE CASCADE,
  CONSTRAINT attendance_site_id_foreign
    FOREIGN KEY (site_id) REFERENCES sites (id)
    ON DELETE CASCADE,
  CONSTRAINT attendance_worker_id_foreign
    FOREIGN KEY (worker_id) REFERENCES workers (id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS worker_payments (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  site_id INT UNSIGNED NOT NULL,
  worker_id INT UNSIGNED NOT NULL,
  recorded_by INT UNSIGNED NOT NULL,
  payment_date DATE NOT NULL,
  type ENUM('wage_payment', 'advance') NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  note TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY worker_payments_site_date_index (site_id, payment_date),
  KEY worker_payments_worker_date_index (worker_id, payment_date),
  KEY worker_payments_type_index (type),
  KEY worker_payments_recorded_by_index (recorded_by),
  CONSTRAINT worker_payments_site_id_foreign
    FOREIGN KEY (site_id) REFERENCES sites (id)
    ON DELETE CASCADE,
  CONSTRAINT worker_payments_worker_id_foreign
    FOREIGN KEY (worker_id) REFERENCES workers (id)
    ON DELETE CASCADE,
  CONSTRAINT worker_payments_recorded_by_foreign
    FOREIGN KEY (recorded_by) REFERENCES users (id)
    ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS report_settings (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  site_id INT UNSIGNED NULL,
  attendance_cutoff_time TIME NOT NULL DEFAULT '21:00:00',
  worker_lock_enabled TINYINT(1) NOT NULL DEFAULT 1,
  worker_cutoff_time TIME NOT NULL DEFAULT '21:00:00',
  stock_lock_enabled TINYINT(1) NOT NULL DEFAULT 1,
  stock_cutoff_time TIME NOT NULL DEFAULT '21:00:00',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY report_settings_site_unique (site_id),
  CONSTRAINT report_settings_site_id_foreign
    FOREIGN KEY (site_id) REFERENCES sites (id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE report_settings
  ADD COLUMN IF NOT EXISTS worker_lock_enabled TINYINT(1) NOT NULL DEFAULT 1 AFTER attendance_cutoff_time,
  ADD COLUMN IF NOT EXISTS worker_cutoff_time TIME NOT NULL DEFAULT '21:00:00' AFTER worker_lock_enabled,
  ADD COLUMN IF NOT EXISTS stock_lock_enabled TINYINT(1) NOT NULL DEFAULT 1 AFTER worker_cutoff_time,
  ADD COLUMN IF NOT EXISTS stock_cutoff_time TIME NOT NULL DEFAULT '21:00:00' AFTER stock_lock_enabled;

UPDATE report_settings
SET worker_cutoff_time = attendance_cutoff_time
WHERE worker_cutoff_time IS NULL OR worker_cutoff_time = '21:00:00';

CREATE TABLE IF NOT EXISTS report_edit_requests (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  daily_report_id BIGINT UNSIGNED NOT NULL,
  requested_by INT UNSIGNED NOT NULL,
  reason TEXT NOT NULL,
  status ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
  reviewed_by INT UNSIGNED NULL,
  reviewed_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT report_edit_requests_daily_report_id_foreign
    FOREIGN KEY (daily_report_id) REFERENCES daily_reports (id)
    ON DELETE CASCADE,
  CONSTRAINT report_edit_requests_requested_by_foreign
    FOREIGN KEY (requested_by) REFERENCES users (id)
    ON DELETE CASCADE,
  CONSTRAINT report_edit_requests_reviewed_by_foreign
    FOREIGN KEY (reviewed_by) REFERENCES users (id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS cash_transfers (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  site_id INT UNSIGNED NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  transfer_date DATE NOT NULL,
  note TEXT NULL,
  created_by INT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY cash_transfers_site_date_index (site_id, transfer_date),
  CONSTRAINT cash_transfers_site_id_foreign
    FOREIGN KEY (site_id) REFERENCES sites (id)
    ON DELETE CASCADE,
  CONSTRAINT cash_transfers_created_by_foreign
    FOREIGN KEY (created_by) REFERENCES users (id)
    ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS stock_items (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(160) NOT NULL,
  unit VARCHAR(40) NOT NULL,
  status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY stock_items_name_unit_unique (name, unit)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS stock_purchases (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  site_id INT UNSIGNED NOT NULL,
  item_id INT UNSIGNED NOT NULL,
  purchase_date DATE NOT NULL,
  quantity DECIMAL(12,2) NOT NULL,
  unit_price DECIMAL(12,2) NOT NULL,
  total_amount DECIMAL(12,2) NOT NULL,
  note TEXT NULL,
  created_by INT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY stock_purchases_site_date_index (site_id, purchase_date),
  KEY stock_purchases_item_id_index (item_id),
  CONSTRAINT stock_purchases_site_id_foreign
    FOREIGN KEY (site_id) REFERENCES sites (id)
    ON DELETE CASCADE,
  CONSTRAINT stock_purchases_item_id_foreign
    FOREIGN KEY (item_id) REFERENCES stock_items (id)
    ON DELETE RESTRICT,
  CONSTRAINT stock_purchases_created_by_foreign
    FOREIGN KEY (created_by) REFERENCES users (id)
    ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS stock_usage (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  site_id INT UNSIGNED NOT NULL,
  item_id INT UNSIGNED NOT NULL,
  usage_date DATE NOT NULL,
  quantity DECIMAL(12,2) NOT NULL,
  note TEXT NULL,
  created_by INT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY stock_usage_site_date_index (site_id, usage_date),
  KEY stock_usage_item_id_index (item_id),
  CONSTRAINT stock_usage_site_id_foreign
    FOREIGN KEY (site_id) REFERENCES sites (id)
    ON DELETE CASCADE,
  CONSTRAINT stock_usage_item_id_foreign
    FOREIGN KEY (item_id) REFERENCES stock_items (id)
    ON DELETE RESTRICT,
  CONSTRAINT stock_usage_created_by_foreign
    FOREIGN KEY (created_by) REFERENCES users (id)
    ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO report_settings (site_id, attendance_cutoff_time)
SELECT NULL, '21:00:00'
WHERE NOT EXISTS (
  SELECT 1 FROM report_settings WHERE site_id IS NULL
);

INSERT INTO users (name, phone, password_hash, role, status)
VALUES (
  'Owner',
  'owner',
  '$2y$10$EWblQdHYagCNWAUiizR9Y.scvsUjnsSZhO3EviEWUloTtg4BZFyum',
  'owner',
  'active'
)
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  role = VALUES(role),
  status = VALUES(status);
