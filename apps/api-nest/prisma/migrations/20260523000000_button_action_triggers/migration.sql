-- Add trigger-scoped submit actions for schema button controls.
ALTER TABLE "form_submit_actions" ADD COLUMN "trigger_key" TEXT;

CREATE INDEX "form_submit_actions_form_id_trigger_key_enabled_sort_order_idx"
ON "form_submit_actions"("form_id", "trigger_key", "enabled", "sort_order");

ALTER TYPE "ActionRunStatus" ADD VALUE 'skipped';
