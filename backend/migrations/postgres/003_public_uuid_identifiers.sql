SET search_path TO volley, public;

-- Additive identifiers: preserve all integer PKs/FKs, JWT IDs and offline journals.
DO $$
DECLARE entity text;
BEGIN
    FOREACH entity IN ARRAY ARRAY[
        'age_groups','audit_logs','competitions','line_judges','match_actions',
        'match_events','match_lineups','match_requests','match_sets','matches',
        'players','referees','scorers','stadiums','team_entries','team_entry_players',
        'team_entry_staff','team_staff','teams','users'
    ] LOOP
        EXECUTE format('ALTER TABLE %I.%I ADD COLUMN public_id uuid NOT NULL DEFAULT gen_random_uuid()', current_schema(), entity);
        EXECUTE format('ALTER TABLE %I.%I ADD CONSTRAINT %I UNIQUE (public_id)', current_schema(), entity, entity || '_public_id_key');
    END LOOP;
END $$;
