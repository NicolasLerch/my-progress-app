-- Add a stable order to exercises within each plan day.
ALTER TABLE "PlanExercise" ADD COLUMN "order" INTEGER;

WITH ranked_exercises AS (
  SELECT "id", ROW_NUMBER() OVER (PARTITION BY "planDayId" ORDER BY "id" ASC) AS "order"
  FROM "PlanExercise"
)
UPDATE "PlanExercise"
SET "order" = ranked_exercises."order"
FROM ranked_exercises
WHERE "PlanExercise"."id" = ranked_exercises."id";

ALTER TABLE "PlanExercise" ALTER COLUMN "order" SET NOT NULL;
CREATE UNIQUE INDEX "PlanExercise_planDayId_order_key" ON "PlanExercise"("planDayId", "order");
