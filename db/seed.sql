INSERT INTO movies (title, genre, description, duration_min, poster_url) VALUES
('Inception',       'Sci-Fi',    'A thief who steals secrets through dreams gets one last impossible job.', 148, NULL),
('The Dark Knight', 'Action',    'Batman faces the Joker, a criminal mastermind who wants chaos in Gotham.', 152, NULL),
('Dangal',          'Drama',     'A former wrestler trains his daughters to become world-class wrestlers.',  161, NULL),
('3 Idiots',        'Comedy',    'Three engineering students chase their dreams in a pressure-filled college.', 170, NULL),
('Drishyam',        'Thriller',  'An ordinary man protects his family after an unexpected crime.',           163, NULL),
('Toy Story',       'Animation', 'A cowboy doll and a space ranger toy learn to be friends.',                 81, NULL);

-- Har movie ke liye agle 2 din mein 2-2 shows (2 PM aur 7 PM)
INSERT INTO shows (movie_id, show_time, regular_price, premium_price)
SELECT m.id,
       date_trunc('day', NOW()) + d.day * INTERVAL '1 day' + t.slot,
       150, 250
FROM movies m
CROSS JOIN (VALUES (1), (2)) AS d(day)
CROSS JOIN (VALUES (INTERVAL '14 hours'), (INTERVAL '19 hours')) AS t(slot);

-- Har show ke 48 seats: rows A-F, har row mein 1-8. A-D regular, E-F premium
INSERT INTO seats (show_id, seat_label, seat_type)
SELECT s.id,
       r.letter || c.n,
       CASE WHEN r.letter IN ('E', 'F') THEN 'premium' ELSE 'regular' END
FROM shows s
CROSS JOIN (VALUES ('A'), ('B'), ('C'), ('D'), ('E'), ('F')) AS r(letter)
CROSS JOIN generate_series(1, 8) AS c(n);