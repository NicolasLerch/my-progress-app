CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

DO $$
DECLARE
  unaccent_schema TEXT;
BEGIN
  SELECT namespace.nspname
  INTO unaccent_schema
  FROM pg_extension AS extension
  INNER JOIN pg_namespace AS namespace ON namespace.oid = extension.extnamespace
  WHERE extension.extname = 'unaccent';

  EXECUTE format(
    'CREATE OR REPLACE FUNCTION public.immutable_unaccent(input TEXT)
     RETURNS TEXT
     LANGUAGE SQL
     IMMUTABLE
     PARALLEL SAFE
     STRICT
     AS %L',
    format(
      'SELECT %I.unaccent(%L::regdictionary, input);',
      unaccent_schema,
      unaccent_schema || '.unaccent'
    )
  );
END $$;

CREATE INDEX IF NOT EXISTS "Exercise_name_normalized_trgm_idx"
ON "Exercise"
USING GIN (public.immutable_unaccent(lower("name")) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "Exercise_muscleGroup_normalized_trgm_idx"
ON "Exercise"
USING GIN (public.immutable_unaccent(lower("muscleGroup")) gin_trgm_ops);
