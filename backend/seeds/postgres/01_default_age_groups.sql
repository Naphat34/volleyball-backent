SET search_path TO volley, public;
INSERT INTO age_groups (name) VALUES ('U12'),('U14'),('U16'),('U18'),('Open')
ON CONFLICT (name) DO NOTHING;
