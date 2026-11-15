import { sqliteTable, text, integer, primaryKey, index } from "drizzle-orm/sqlite-core";

// One versioned document per owner gives related planner/reward/reminder changes
// a single atomic compare-and-swap boundary. Provider credentials live separately.
export const states = sqliteTable("qi_states", {
  owner: text("owner").primaryKey(), revision: integer("revision").notNull().default(0),
  schemaVersion: integer("schema_version").notNull().default(2), data: text("data").notNull(),
  lastOperation: text("last_operation"), updatedAt: text("updated_at").notNull(),
});
export const operations = sqliteTable("qi_operations", {
  owner: text("owner").notNull(), id: text("id").notNull(), revision: integer("revision").notNull(), createdAt: text("created_at").notNull(),
}, t => [primaryKey({columns:[t.owner,t.id]})]);
export const secrets = sqliteTable("qi_secrets", {
  owner: text("owner").notNull(), name: text("name").notNull(), ciphertext: text("ciphertext").notNull(),
}, t => [primaryKey({columns:[t.owner,t.name]})]);
export const backups = sqliteTable("qi_backups", {
  id: text("id").primaryKey(), owner: text("owner").notNull(), createdAt: text("created_at").notNull(),
  revision: integer("revision").notNull(), kind: text("kind").notNull(), checksum: text("checksum").notNull(),
  size: integer("size").notNull(), verified: integer("verified").notNull().default(0),
  oneDriveId: text("onedrive_id"), oneDriveAt: text("onedrive_at"), localAt: text("local_at"), error: text("error"),
});
export const devices = sqliteTable("qi_devices", {
  id: text("id").primaryKey(), owner: text("owner").notNull(), subscription: text("subscription").notNull(),
  enabled: integer("enabled").notNull().default(1), label: text("label").notNull(), updatedAt: text("updated_at").notNull(),
});
export const helpers = sqliteTable("qi_helpers", {
  id: text("id").primaryKey(), owner: text("owner").notNull(), tokenHash: text("token_hash").notNull(),
  lastSeen: text("last_seen"), revoked: integer("revoked").notNull().default(0),
});
export const deliveries = sqliteTable("qi_deliveries", {
  owner:text("owner").notNull(), tag:text("tag").notNull(), device:text("device").notNull(),
  status:text("status").notNull().default("pending"), at:text("at").notNull(), error:text("error"),
},t=>[primaryKey({columns:[t.owner,t.tag,t.device]})]);
export const careers=sqliteTable('qi_careers',{owner:text('owner').primaryKey(),id:text('id').notNull(),revision:integer('revision').notNull().default(0),data:text('data').notNull(),lastOperation:text('last_operation'),updatedAt:text('updated_at').notNull()});
export const careerOperations=sqliteTable('qi_career_operations',{owner:text('owner').notNull(),id:text('id').notNull(),revision:integer('revision').notNull(),createdAt:text('created_at').notNull()},t=>[primaryKey({columns:[t.owner,t.id]})]);
export const careerObjects=sqliteTable('qi_career_objects',{owner:text('owner').notNull(),careerId:text('career_id').notNull(),id:text('id').notNull(),objectKey:text('object_key').notNull(),checksum:text('checksum').notNull(),kind:text('kind').notNull(),fixtureId:text('fixture_id').notNull(),sequence:integer('sequence').notNull(),createdAt:text('created_at').notNull()},t=>[primaryKey({columns:[t.owner,t.id]}),index('qi_career_objects_fixture').on(t.owner,t.careerId,t.fixtureId,t.sequence)]);
export const careerReceipts=sqliteTable('qi_career_receipts',{owner:text('owner').notNull(),careerId:text('career_id').notNull(),id:text('id').notNull(),kind:text('kind').notNull(),data:text('data').notNull(),createdAt:text('created_at').notNull()},t=>[primaryKey({columns:[t.owner,t.careerId,t.id]})]);
