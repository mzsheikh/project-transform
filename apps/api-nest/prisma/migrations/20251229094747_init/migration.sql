-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('user', 'admin');

-- CreateEnum
CREATE TYPE "FormStatus" AS ENUM ('draft', 'published', 'archived');

-- CreateEnum
CREATE TYPE "SubmissionStatus" AS ENUM ('draft', 'pending_sync', 'submitted', 'synced', 'failed');

-- CreateTable
CREATE TABLE "apps" (
    "app_code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "settings" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "apps_pkey" PRIMARY KEY ("app_code")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "app_code" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'user',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "groups" (
    "id" UUID NOT NULL,
    "app_code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "group_members" (
    "group_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,

    CONSTRAINT "group_members_pkey" PRIMARY KEY ("group_id","user_id")
);

-- CreateTable
CREATE TABLE "forms" (
    "id" UUID NOT NULL,
    "app_code" TEXT NOT NULL,
    "form_key" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "status" "FormStatus" NOT NULL DEFAULT 'draft',
    "title" TEXT NOT NULL,
    "description" TEXT,
    "schema_json" JSONB NOT NULL,
    "created_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "forms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "submissions" (
    "id" UUID NOT NULL,
    "app_code" TEXT NOT NULL,
    "form_key" TEXT NOT NULL,
    "form_version" INTEGER NOT NULL,
    "user_id" UUID,
    "status" "SubmissionStatus" NOT NULL DEFAULT 'draft',
    "data_json" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "submissions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "users_app_code_username_idx" ON "users"("app_code", "username");

-- CreateIndex
CREATE UNIQUE INDEX "users_app_code_username_key" ON "users"("app_code", "username");

-- CreateIndex
CREATE INDEX "groups_app_code_name_idx" ON "groups"("app_code", "name");

-- CreateIndex
CREATE UNIQUE INDEX "groups_app_code_name_key" ON "groups"("app_code", "name");

-- CreateIndex
CREATE INDEX "group_members_user_id_idx" ON "group_members"("user_id");

-- CreateIndex
CREATE INDEX "forms_app_code_form_key_status_idx" ON "forms"("app_code", "form_key", "status");

-- CreateIndex
CREATE UNIQUE INDEX "forms_app_code_form_key_version_key" ON "forms"("app_code", "form_key", "version");

-- CreateIndex
CREATE INDEX "submissions_app_code_form_key_created_at_idx" ON "submissions"("app_code", "form_key", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_app_code_fkey" FOREIGN KEY ("app_code") REFERENCES "apps"("app_code") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "groups" ADD CONSTRAINT "groups_app_code_fkey" FOREIGN KEY ("app_code") REFERENCES "apps"("app_code") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_members" ADD CONSTRAINT "group_members_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_members" ADD CONSTRAINT "group_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forms" ADD CONSTRAINT "forms_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forms" ADD CONSTRAINT "forms_app_code_fkey" FOREIGN KEY ("app_code") REFERENCES "apps"("app_code") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_app_code_fkey" FOREIGN KEY ("app_code") REFERENCES "apps"("app_code") ON DELETE CASCADE ON UPDATE CASCADE;
