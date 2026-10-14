CREATE TYPE "EmploymentStatus" AS ENUM ('ACTIVE', 'INACTIVE');
CREATE TYPE "Currency" AS ENUM ('USD', 'EUR', 'GBP', 'INR', 'CAD', 'AUD', 'SGD', 'JPY', 'BHD');

CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "password_hash" VARCHAR(100) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "employees" (
    "id" TEXT NOT NULL,
    "employee_number" VARCHAR(32) NOT NULL,
    "full_name" VARCHAR(160) NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "department" VARCHAR(100) NOT NULL,
    "job_title" VARCHAR(120) NOT NULL,
    "country" VARCHAR(80) NOT NULL,
    "currency" "Currency" NOT NULL,
    "status" "EmploymentStatus" NOT NULL DEFAULT 'ACTIVE',
    "current_salary" DECIMAL(19,4) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "employees_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "employees_current_salary_positive" CHECK ("current_salary" > 0)
);

CREATE TABLE "salary_revisions" (
    "id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "previous_salary" DECIMAL(19,4),
    "new_salary" DECIMAL(19,4) NOT NULL,
    "currency" "Currency" NOT NULL,
    "effective_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reason" VARCHAR(500),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "salary_revisions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "salary_revisions_new_salary_positive" CHECK ("new_salary" > 0)
);

CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE UNIQUE INDEX "employees_employee_number_key" ON "employees"("employee_number");
CREATE UNIQUE INDEX "employees_email_key" ON "employees"("email");
CREATE INDEX "employees_status_department_idx" ON "employees"("status", "department");
CREATE INDEX "employees_country_status_idx" ON "employees"("country", "status");
CREATE INDEX "employees_full_name_idx" ON "employees"("full_name");
CREATE INDEX "salary_revisions_employee_id_effective_at_idx" ON "salary_revisions"("employee_id", "effective_at" DESC);
ALTER TABLE "salary_revisions" ADD CONSTRAINT "salary_revisions_employee_id_fkey"
  FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
