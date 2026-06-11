ALTER TABLE "PlanExercise"
ALTER COLUMN "targetReps" TYPE TEXT
USING "targetReps"::TEXT;

ALTER TABLE "WorkoutExercise"
ALTER COLUMN "targetReps" TYPE TEXT
USING "targetReps"::TEXT;
