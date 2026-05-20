-- CreateEnum
CREATE TYPE "ConnectorType" AS ENUM ('database', 'rest_api');

-- CreateEnum
CREATE TYPE "DatabaseProvider" AS ENUM ('postgresql', 'mysql', 'sqlserver');

-- CreateEnum
CREATE TYPE "SubmitActionType" AS ENUM ('email_pdf', 'database', 'rest_api');

-- CreateEnum
CREATE TYPE "ActionRunStatus" AS ENUM ('pending', 'running', 'success', 'failed');

-- CreateTable
CREATE TABLE "connectors" (
    "id" UUID NOT NULL,
    "app_code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "ConnectorType" NOT NULL,
    "provider" "DatabaseProvider",
    "config_json" JSONB NOT NULL DEFAULT '{}',
    "secrets_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "connectors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "form_submit_actions" (
    "id" UUID NOT NULL,
    "app_code" TEXT NOT NULL,
    "form_id" UUID NOT NULL,
    "form_key" TEXT NOT NULL,
    "form_version" INTEGER NOT NULL,
    "type" "SubmitActionType" NOT NULL,
    "name" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "connector_id" UUID,
    "config_json" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "form_submit_actions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "submission_action_runs" (
    "id" UUID NOT NULL,
    "app_code" TEXT NOT NULL,
    "submission_id" UUID NOT NULL,
    "action_id" UUID,
    "action_type" "SubmitActionType" NOT NULL,
    "action_name" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "status" "ActionRunStatus" NOT NULL DEFAULT 'pending',
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "max_attempts" INTEGER NOT NULL DEFAULT 3,
    "next_attempt_at" TIMESTAMP(3),
    "last_attempt_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "action_snapshot" JSONB NOT NULL,
    "response_json" JSONB,
    "error_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "submission_action_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "connector_schema_snapshots" (
    "id" UUID NOT NULL,
    "app_code" TEXT NOT NULL,
    "connector_id" UUID NOT NULL,
    "snapshot_json" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "connector_schema_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "connectors_app_code_name_key" ON "connectors"("app_code", "name");

-- CreateIndex
CREATE INDEX "connectors_app_code_type_idx" ON "connectors"("app_code", "type");

-- CreateIndex
CREATE INDEX "form_submit_actions_app_code_form_key_form_version_idx" ON "form_submit_actions"("app_code", "form_key", "form_version");

-- CreateIndex
CREATE INDEX "form_submit_actions_form_id_enabled_sort_order_idx" ON "form_submit_actions"("form_id", "enabled", "sort_order");

-- CreateIndex
CREATE INDEX "submission_action_runs_app_code_status_next_attempt_at_idx" ON "submission_action_runs"("app_code", "status", "next_attempt_at");

-- CreateIndex
CREATE INDEX "submission_action_runs_submission_id_sort_order_idx" ON "submission_action_runs"("submission_id", "sort_order");

-- CreateIndex
CREATE INDEX "connector_schema_snapshots_app_code_connector_id_created_at_idx" ON "connector_schema_snapshots"("app_code", "connector_id", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "connectors" ADD CONSTRAINT "connectors_app_code_fkey" FOREIGN KEY ("app_code") REFERENCES "apps"("app_code") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "form_submit_actions" ADD CONSTRAINT "form_submit_actions_app_code_fkey" FOREIGN KEY ("app_code") REFERENCES "apps"("app_code") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "form_submit_actions" ADD CONSTRAINT "form_submit_actions_form_id_fkey" FOREIGN KEY ("form_id") REFERENCES "forms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "form_submit_actions" ADD CONSTRAINT "form_submit_actions_connector_id_fkey" FOREIGN KEY ("connector_id") REFERENCES "connectors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submission_action_runs" ADD CONSTRAINT "submission_action_runs_app_code_fkey" FOREIGN KEY ("app_code") REFERENCES "apps"("app_code") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submission_action_runs" ADD CONSTRAINT "submission_action_runs_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submission_action_runs" ADD CONSTRAINT "submission_action_runs_action_id_fkey" FOREIGN KEY ("action_id") REFERENCES "form_submit_actions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "connector_schema_snapshots" ADD CONSTRAINT "connector_schema_snapshots_connector_id_fkey" FOREIGN KEY ("connector_id") REFERENCES "connectors"("id") ON DELETE CASCADE ON UPDATE CASCADE;
