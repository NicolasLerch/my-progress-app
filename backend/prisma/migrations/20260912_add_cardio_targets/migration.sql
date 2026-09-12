ALTER TABLE "PlanExercise"
  ADD COLUMN "targetDistanceMeters" INTEGER CHECK ("targetDistanceMeters" >= 0),
  ADD COLUMN "targetInclinePercent" DOUBLE PRECISION CHECK ("targetInclinePercent" >= 0 AND "targetInclinePercent" < 'Infinity'::float8);

ALTER TABLE "WorkoutExercise"
  ADD COLUMN "targetDistanceMeters" INTEGER CHECK ("targetDistanceMeters" >= 0),
  ADD COLUMN "targetInclinePercent" DOUBLE PRECISION CHECK ("targetInclinePercent" >= 0 AND "targetInclinePercent" < 'Infinity'::float8);
