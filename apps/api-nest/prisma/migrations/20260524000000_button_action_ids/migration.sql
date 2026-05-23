ALTER TABLE "form_submit_actions" ADD COLUMN "button_action_id" TEXT;

CREATE INDEX "form_submit_actions_form_id_trigger_key_button_action_id_idx"
ON "form_submit_actions"("form_id", "trigger_key", "button_action_id");
