CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS "Exercise_name_trgm_idx"
ON "Exercise"
USING GIN ("name" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "Exercise_muscleGroup_trgm_idx"
ON "Exercise"
USING GIN ("muscleGroup" gin_trgm_ops);
