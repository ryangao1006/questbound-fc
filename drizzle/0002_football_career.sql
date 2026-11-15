CREATE TABLE `qi_career_objects` (
	`owner` text NOT NULL,
	`career_id` text NOT NULL,
	`id` text NOT NULL,
	`object_key` text NOT NULL,
	`checksum` text NOT NULL,
	`kind` text NOT NULL,
	`fixture_id` text NOT NULL,
	`sequence` integer NOT NULL,
	`created_at` text NOT NULL,
	PRIMARY KEY(`owner`, `id`)
);
--> statement-breakpoint
CREATE INDEX `qi_career_objects_fixture` ON `qi_career_objects` (`owner`,`career_id`,`fixture_id`,`sequence`);--> statement-breakpoint
CREATE TABLE `qi_career_operations` (
	`owner` text NOT NULL,
	`id` text NOT NULL,
	`revision` integer NOT NULL,
	`created_at` text NOT NULL,
	PRIMARY KEY(`owner`, `id`)
);
--> statement-breakpoint
CREATE TABLE `qi_career_receipts` (
	`owner` text NOT NULL,
	`career_id` text NOT NULL,
	`id` text NOT NULL,
	`kind` text NOT NULL,
	`data` text NOT NULL,
	`created_at` text NOT NULL,
	PRIMARY KEY(`owner`, `career_id`, `id`)
);
--> statement-breakpoint
CREATE TABLE `qi_careers` (
	`owner` text PRIMARY KEY NOT NULL,
	`id` text NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL,
	`data` text NOT NULL,
	`last_operation` text,
	`updated_at` text NOT NULL
);
