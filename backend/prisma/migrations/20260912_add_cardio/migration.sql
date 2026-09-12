CREATE TYPE "ExerciseType" AS ENUM ('STRENGTH', 'CARDIO');
ALTER TABLE "Exercise" ADD COLUMN "type" "ExerciseType" NOT NULL DEFAULT 'STRENGTH';

ALTER TABLE "PlanExercise"
  ALTER COLUMN "targetSets" DROP NOT NULL,
  ALTER COLUMN "targetReps" DROP NOT NULL,
  ALTER COLUMN "restSeconds" DROP NOT NULL,
  ADD COLUMN "targetDurationMinutes" INTEGER;
ALTER TABLE "WorkoutExercise"
  ALTER COLUMN "targetSets" DROP NOT NULL,
  ALTER COLUMN "targetReps" DROP NOT NULL,
  ALTER COLUMN "restSeconds" DROP NOT NULL,
  ADD COLUMN "targetDurationMinutes" INTEGER;

CREATE TABLE "CardioResult" (
  "id" TEXT NOT NULL,
  "workoutExerciseId" TEXT NOT NULL,
  "durationMinutes" INTEGER NOT NULL CHECK ("durationMinutes" > 0),
  "distanceMeters" INTEGER CHECK ("distanceMeters" >= 0),
  "inclinePercent" DOUBLE PRECISION CHECK ("inclinePercent" >= 0 AND "inclinePercent" < 'Infinity'::float8),
  CONSTRAINT "CardioResult_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CardioResult_workoutExerciseId_fkey" FOREIGN KEY ("workoutExerciseId") REFERENCES "WorkoutExercise"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "CardioResult_workoutExerciseId_key" ON "CardioResult"("workoutExerciseId");

INSERT INTO "Exercise" ("id", "name", "muscleGroup", "type") VALUES
  ('cardio-treadmill', 'Cinta', 'Cardio', 'CARDIO'),
  ('cardio-stationary-bike', 'Bicicleta fija', 'Cardio', 'CARDIO'),
  ('cardio-stair-climber', 'Escaladora', 'Cardio', 'CARDIO'),
  ('cardio-elliptical', 'Elíptico', 'Cardio', 'CARDIO'),
  ('cardio-rowing-ergometer', 'Remo ergómetro', 'Cardio', 'CARDIO')
ON CONFLICT ("id") DO NOTHING;
