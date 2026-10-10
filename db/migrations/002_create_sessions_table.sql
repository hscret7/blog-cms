-- Bảng lưu session cho express-mysql-session.
-- expires lưu thời điểm hết hạn dạng Unix timestamp, đơn vị giây.

CREATE TABLE sessions (
    session_id VARCHAR(128) NOT NULL,
    expires INT UNSIGNED NOT NULL,
    data MEDIUMTEXT NULL,

    PRIMARY KEY (session_id),
    KEY idx_sessions_expires (expires)
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_bin;