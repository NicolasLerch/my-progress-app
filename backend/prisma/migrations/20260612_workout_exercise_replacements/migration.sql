ALTER TABLE "WorkoutExercise"
ADD COLUMN "position" INTEGER,
ADD COLUMN "replacesPlanExerciseId" TEXT,
ADD COLUMN "replacementReason" TEXT,
ADD COLUMN "isReplacement" BOOLEAN NOT NULL DEFAULT false;

WITH ordered_exercises AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (PARTITION BY "workoutSessionId" ORDER BY "id") AS row_number
  FROM "WorkoutExercise"
)
UPDATE "WorkoutExercise" AS we
SET "position" = ordered_exercises.row_number
FROM ordered_exercises
WHERE we."id" = ordered_exercises."id";

ALTER TABLE "WorkoutExercise"
ALTER COLUMN "position" SET NOT NULL;

DROP INDEX "WorkoutExercise_workoutSessionId_exerciseId_key";

CREATE INDEX "WorkoutExercise_workoutSessionId_position_idx" ON "WorkoutExercise"("workoutSessionId", "position");
