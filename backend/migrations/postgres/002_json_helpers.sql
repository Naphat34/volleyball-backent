SET search_path TO volley, public;

-- Legacy match_events/details is text; canonical payload columns are jsonb.
-- These overloads keep safe extraction identical for both storage formats.
CREATE FUNCTION valid_json(value jsonb) RETURNS boolean LANGUAGE sql IMMUTABLE STRICT
AS $$ SELECT true $$;

CREATE FUNCTION json_extract(value jsonb, json_path text) RETURNS jsonb
LANGUAGE plpgsql IMMUTABLE STRICT AS $$
BEGIN
    IF json_path !~ '^\$\.[A-Za-z_][A-Za-z_0-9]*(\.[A-Za-z_][A-Za-z_0-9]*)*$' THEN
        RAISE EXCEPTION 'Unsupported JSON path' USING ERRCODE = '22023';
    END IF;
    RETURN value #> string_to_array(substring(json_path FROM 3), '.');
END $$;

CREATE FUNCTION json_extract(value text, json_path text) RETURNS jsonb
LANGUAGE sql IMMUTABLE STRICT AS $$ SELECT json_extract(value::jsonb, json_path) $$;

CREATE FUNCTION json_unquote(value jsonb) RETURNS text
LANGUAGE sql IMMUTABLE STRICT AS $$ SELECT value #>> '{}' $$;
