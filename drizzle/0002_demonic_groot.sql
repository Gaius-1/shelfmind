CREATE INDEX `idx_duplicate_org_id` ON `duplicate_pairs` (`org_id`);--> statement-breakpoint
CREATE INDEX `idx_duplicate_record_a` ON `duplicate_pairs` (`record_a_id`);--> statement-breakpoint
CREATE INDEX `idx_duplicate_record_b` ON `duplicate_pairs` (`record_b_id`);--> statement-breakpoint
CREATE INDEX `idx_duplicate_status` ON `duplicate_pairs` (`status`);--> statement-breakpoint
CREATE INDEX `idx_imdb_job_id` ON `imdb_records` (`job_id`);--> statement-breakpoint
CREATE INDEX `idx_imdb_org_id` ON `imdb_records` (`organisation_id`);--> statement-breakpoint
CREATE INDEX `idx_imdb_barcode` ON `imdb_records` (`BARCODE`);--> statement-breakpoint
CREATE INDEX `idx_imdb_group_key` ON `imdb_records` (`product_group_key`);--> statement-breakpoint
CREATE INDEX `idx_jobs_org_id` ON `jobs` (`organisation_id`);--> statement-breakpoint
CREATE INDEX `idx_jobs_status` ON `jobs` (`status`);