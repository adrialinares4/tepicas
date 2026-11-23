-- Tepicas · esquema D1 (SQLite)

CREATE TABLE IF NOT EXISTS plays (
  device_id   TEXT    NOT NULL,
  day         TEXT    NOT NULL,           -- YYYY-MM-DD (Europe/Madrid)
  avg_ms      INTEGER,                    -- NULL si hubo menos de 3 intentos válidos
  attempts    TEXT    NOT NULL,           -- JSON con los 5 tiempos enviados
  valid_count INTEGER NOT NULL,
  created_at  INTEGER NOT NULL,
  PRIMARY KEY (device_id, day)
);
CREATE INDEX IF NOT EXISTS idx_plays_day ON plays(day);

CREATE TABLE IF NOT EXISTS leagues (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  code           TEXT    NOT NULL UNIQUE,
  name           TEXT    NOT NULL,
  creator_device TEXT    NOT NULL,
  day            TEXT    NOT NULL,
  created_at     INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_leagues_creator ON leagues(creator_device, day);

CREATE TABLE IF NOT EXISTS members (
  league_id INTEGER NOT NULL,
  device_id TEXT    NOT NULL,
  nickname  TEXT    NOT NULL COLLATE NOCASE,
  role      TEXT    NOT NULL,             -- 'owner' | 'member'
  day       TEXT    NOT NULL,
  joined_at INTEGER NOT NULL,
  PRIMARY KEY (league_id, device_id),
  UNIQUE (league_id, nickname)
);
CREATE INDEX IF NOT EXISTS idx_members_device ON members(device_id);

CREATE TABLE IF NOT EXISTS events (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  day        TEXT    NOT NULL,
  type       TEXT    NOT NULL,            -- visit | invite_open | invite_share | result_share
  device_id  TEXT    NOT NULL,
  league_id  INTEGER,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_events_day_type ON events(day, type);
CREATE UNIQUE INDEX IF NOT EXISTS ux_events_visit ON events(day, device_id) WHERE type = 'visit';

-- Minijuegos libres: mejor marca por dispositivo, juego y día
CREATE TABLE IF NOT EXISTS scores (
  device_id  TEXT    NOT NULL,
  game       TEXT    NOT NULL,
  day        TEXT    NOT NULL,
  best       INTEGER NOT NULL,
  runs       INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (device_id, game, day)
);
CREATE INDEX IF NOT EXISTS idx_scores_game_day ON scores(game, day);

-- Páginas vistas (sin cookies): base de páginas/sesión y duración
CREATE TABLE IF NOT EXISTS pageviews (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  day        TEXT    NOT NULL,
  device_id  TEXT    NOT NULL,
  session_id TEXT    NOT NULL,
  path       TEXT    NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_pv_day ON pageviews(day);
CREATE INDEX IF NOT EXISTS idx_pv_session ON pageviews(session_id);

CREATE INDEX IF NOT EXISTS idx_pv_device ON pageviews(device_id, day);

-- Origen de cada sesión (primera página): utm_source, referer o directo
CREATE TABLE IF NOT EXISTS sessions (
  session_id TEXT    PRIMARY KEY,
  device_id  TEXT    NOT NULL,
  day        TEXT    NOT NULL,
  source     TEXT    NOT NULL,
  campaign   TEXT    NOT NULL DEFAULT '',
  landing    TEXT    NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_device ON sessions(device_id, created_at);
