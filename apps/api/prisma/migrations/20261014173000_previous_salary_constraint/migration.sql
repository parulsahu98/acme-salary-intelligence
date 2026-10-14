ALTER TABLE "salary_revisions"
ADD CONSTRAINT "salary_revisions_previous_salary_positive"
CHECK ("previous_salary" IS NULL OR "previous_salary" > 0);
