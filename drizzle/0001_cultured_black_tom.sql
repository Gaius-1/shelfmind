CREATE TABLE `duplicate_pairs` (
	`id` text PRIMARY KEY NOT NULL,
	`org_id` text NOT NULL,
	`record_a_id` text NOT NULL,
	`record_b_id` text NOT NULL,
	`similarity_score` real,
	`reason` text,
	`status` text DEFAULT 'PENDING',
	`created_at` text DEFAULT (datetime('now')),
	`resolved_at` text,
	FOREIGN KEY (`org_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`record_a_id`) REFERENCES `imdb_records`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`record_b_id`) REFERENCES `imdb_records`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
ALTER TABLE `imdb_records` ADD `status` text DEFAULT 'ACTIVE';--> statement-breakpoint
ALTER TABLE `imdb_records` ADD `merged_into_id` text;