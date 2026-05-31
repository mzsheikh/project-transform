CREATE TABLE "form_database_mappings" (
  "id" UUID NOT NULL,
  "app_code" TEXT NOT NULL,
  "connector_id" UUID NOT NULL,
  "form_id" UUID NOT NULL,
  "form_key" TEXT NOT NULL,
  "form_version" INTEGER NOT NULL,
  "name" TEXT NOT NULL,
  "mapping_json" JSONB NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "form_database_mappings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "form_database_mappings_connector_id_form_id_key"
ON "form_database_mappings"("connector_id", "form_id");

CREATE INDEX "form_database_mappings_app_code_connector_id_idx"
ON "form_database_mappings"("app_code", "connector_id");

CREATE INDEX "form_database_mappings_app_code_form_key_form_version_idx"
ON "form_database_mappings"("app_code", "form_key", "form_version");

ALTER TABLE "form_database_mappings"
ADD CONSTRAINT "form_database_mappings_app_code_fkey"
FOREIGN KEY ("app_code") REFERENCES "apps"("app_code") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "form_database_mappings"
ADD CONSTRAINT "form_database_mappings_connector_id_fkey"
FOREIGN KEY ("connector_id") REFERENCES "connectors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "form_database_mappings"
ADD CONSTRAINT "form_database_mappings_form_id_fkey"
FOREIGN KEY ("form_id") REFERENCES "forms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
