CREATE TABLE `qi_backups` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`created_at` text NOT NULL,
	`revision` integer NOT NULL,
	`kind` text NOT NULL,
	`checksum` text NOT NULL,
	`size` integer NOT NULL,
	`verified` integer DEFAULT 0 NOT NULL,
	`onedrive_id` text,
	`onedrive_at` text,
	`local_at` text,
	`error` text
);
--> statement-breakpoint
CREATE TABLE `qi_devices` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`subscription` text NOT NULL,
	`enabled` integer DEFAULT 1 NOT NULL,
	`label` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `qi_helpers` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`token_hash` text NOT NULL,
	`last_seen` text,
	`revoked` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `qi_operations` (
	`owner` text NOT NULL,
	`id` text NOT NULL,
	`revision` integer NOT NULL,
	`created_at` text NOT NULL,
	PRIMARY KEY(`owner`, `id`)
);
--> statement-breakpoint
CREATE TABLE `qi_secrets` (
	`owner` text NOT NULL,
	`name` text NOT NULL,
	`ciphertext` text NOT NULL,
	PRIMARY KEY(`owner`, `name`)
);
--> statement-breakpoint
CREATE TABLE `qi_states` (
	`owner` text PRIMARY KEY NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL,
	`schema_version` integer DEFAULT 2 NOT NULL,
	`data` text NOT NULL,
	`last_operation` text,
	`updated_at` text NOT NULL
);
