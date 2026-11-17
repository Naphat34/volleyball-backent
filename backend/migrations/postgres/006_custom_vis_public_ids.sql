ALTER TABLE custom_vis_matches ADD COLUMN IF NOT EXISTS public_id uuid;
UPDATE custom_vis_matches SET public_id = substring(id FROM 8)::uuid WHERE public_id IS NULL;
ALTER TABLE custom_vis_matches ALTER COLUMN public_id SET DEFAULT gen_random_uuid(), ALTER COLUMN public_id SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS custom_vis_matches_public_id_key ON custom_vis_matches(public_id);
