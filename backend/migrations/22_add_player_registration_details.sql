ALTER TABLE players
  ADD COLUMN title VARCHAR(30) NULL,
  ADD COLUMN middle_name VARCHAR(100) NULL,
  ADD COLUMN jersey_name VARCHAR(80) NULL,
  ADD COLUMN national_id CHAR(13) NULL,
  ADD COLUMN fivb_id VARCHAR(80) NULL,
  ADD COLUMN hometown VARCHAR(150) NULL,
  ADD COLUMN school_affiliation VARCHAR(200) NULL,
  ADD COLUMN grade_level VARCHAR(80) NULL,
  ADD COLUMN contact_phone VARCHAR(30) NULL,
  ADD COLUMN identity_document_url VARCHAR(500) NULL,
  ADD COLUMN student_certificate_url VARCHAR(500) NULL,
  ADD COLUMN guardian_consent_url VARCHAR(500) NULL;
