-- Dobara run karne par purani tables hat jayengi (sirf development ke liye)
DROP TABLE IF EXISTS bookings CASCADE;
DROP TABLE IF EXISTS seats    CASCADE;
DROP TABLE IF EXISTS shows    CASCADE;
DROP TABLE IF EXISTS movies   CASCADE;
DROP TABLE IF EXISTS users    CASCADE;

CREATE TABLE users (
  id            SERIAL PRIMARY KEY,
  name          VARCHAR(100) NOT NULL,
  email         VARCHAR(150) NOT NULL UNIQUE,
  password_hash TEXT         NOT NULL,
  role          VARCHAR(10)  NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  created_at    TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE TABLE movies (
  id           SERIAL PRIMARY KEY,
  title        VARCHAR(200) NOT NULL,
  genre        VARCHAR(50)  NOT NULL,
  description  TEXT,
  duration_min INT,
  poster_url   TEXT,
  is_hidden    BOOLEAN      NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE TABLE shows (
  id            SERIAL PRIMARY KEY,
  movie_id      INT           NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
  show_time     TIMESTAMP     NOT NULL,
  regular_price NUMERIC(8,2)  NOT NULL DEFAULT 150,
  premium_price NUMERIC(8,2)  NOT NULL DEFAULT 250
);

CREATE TABLE seats (
  id         SERIAL PRIMARY KEY,
  show_id    INT         NOT NULL REFERENCES shows(id) ON DELETE CASCADE,
  seat_label VARCHAR(5)  NOT NULL,
  seat_type  VARCHAR(10) NOT NULL DEFAULT 'regular' CHECK (seat_type IN ('regular', 'premium')),
  is_booked  BOOLEAN     NOT NULL DEFAULT FALSE,
  UNIQUE (show_id, seat_label)
);

CREATE TABLE bookings (
  id                SERIAL PRIMARY KEY,
  user_id           INT           NOT NULL REFERENCES users(id),
  show_id           INT           NOT NULL REFERENCES shows(id),
  seat_ids          INT[]         NOT NULL,
  seat_labels       TEXT          NOT NULL,
  total_price       NUMERIC(10,2) NOT NULL,
  confirmation_code VARCHAR(20)   NOT NULL UNIQUE,
  created_at        TIMESTAMP     NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_shows_movie    ON shows(movie_id);
CREATE INDEX idx_seats_show     ON seats(show_id);
CREATE INDEX idx_bookings_user  ON bookings(user_id);