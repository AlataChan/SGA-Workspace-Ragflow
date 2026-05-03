CREATE TYPE "MoltConversationSource" AS ENUM ('MOLT', 'LEGACY_WORKSPACE');
CREATE TYPE "MoltMigrationStatus" AS ENUM ('NEW', 'MIGRATING', 'MIGRATED', 'ARCHIVED');

CREATE TABLE "molt_conversation_mappings" (
  "id" TEXT NOT NULL,
  "workspace_session_id" TEXT NOT NULL,
  "molt_conversation_id" TEXT,
  "agent_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "company_id" TEXT NOT NULL,
  "source" "MoltConversationSource" NOT NULL DEFAULT 'MOLT',
  "migration_status" "MoltMigrationStatus" NOT NULL DEFAULT 'NEW',
  "last_sync_cursor" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "molt_conversation_mappings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "molt_conversation_mappings_workspace_session_id_key"
  ON "molt_conversation_mappings"("workspace_session_id");

CREATE UNIQUE INDEX "molt_conversation_mappings_molt_conversation_id_key"
  ON "molt_conversation_mappings"("molt_conversation_id");

CREATE INDEX "molt_conversation_mappings_user_id_agent_id_idx"
  ON "molt_conversation_mappings"("user_id", "agent_id");

CREATE INDEX "molt_conversation_mappings_company_id_agent_id_idx"
  ON "molt_conversation_mappings"("company_id", "agent_id");

ALTER TABLE "molt_conversation_mappings"
  ADD CONSTRAINT "molt_conversation_mappings_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "molt_conversation_mappings"
  ADD CONSTRAINT "molt_conversation_mappings_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "molt_conversation_mappings"
  ADD CONSTRAINT "molt_conversation_mappings_agent_id_fkey"
  FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "molt_conversation_mappings"
  ADD CONSTRAINT "molt_conversation_mappings_workspace_session_id_fkey"
  FOREIGN KEY ("workspace_session_id") REFERENCES "chat_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
