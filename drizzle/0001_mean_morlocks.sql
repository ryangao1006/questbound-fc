CREATE TABLE `qi_deliveries` (
	`owner` text NOT NULL,
	`tag` text NOT NULL,
	`device` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`at` text NOT NULL,
	`error` text,
	PRIMARY KEY(`owner`, `tag`, `device`)
);
