CREATE TABLE IF NOT EXISTS volley.court_station_pairings (
    match_id integer NOT NULL REFERENCES volley.matches(id) ON DELETE CASCADE,
    side char(1) NOT NULL CHECK (side IN ('A', 'B')),
    pairing_id varchar(36) NOT NULL,
    paired_user_id integer REFERENCES volley.users(id) ON DELETE CASCADE,
    PRIMARY KEY (match_id, side)
);
