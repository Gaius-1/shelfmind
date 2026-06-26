ALTER TABLE `jobs` ADD `vision_model` text;--> statement-breakpoint
ALTER TABLE `jobs` ADD `input_tokens` integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE `jobs` ADD `output_tokens` integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE `jobs` ADD `total_cost` real DEFAULT 0;