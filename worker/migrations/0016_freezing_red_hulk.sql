CREATE TABLE `trip_expense_categories` (
	`org_id` text NOT NULL,
	`name` text NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	PRIMARY KEY(`org_id`, `name`),
	FOREIGN KEY (`org_id`) REFERENCES `orgs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `trip_expenses` ADD `category` text;
--> statement-breakpoint
-- Starting categories for every company; the Manager adds more under Master.
INSERT INTO `trip_expense_categories` (`org_id`, `name`, `active`) SELECT `id`, 'Diesel', 1 FROM `orgs`;
--> statement-breakpoint
INSERT INTO `trip_expense_categories` (`org_id`, `name`, `active`) SELECT `id`, 'Driver Trip Expenses', 1 FROM `orgs`;
--> statement-breakpoint
INSERT INTO `trip_expense_categories` (`org_id`, `name`, `active`) SELECT `id`, 'Toll', 1 FROM `orgs`;
--> statement-breakpoint
INSERT INTO `trip_expense_categories` (`org_id`, `name`, `active`) SELECT `id`, 'Loading / Unloading', 1 FROM `orgs`;
--> statement-breakpoint
INSERT INTO `trip_expense_categories` (`org_id`, `name`, `active`) SELECT `id`, 'Repairs & Tyres', 1 FROM `orgs`;
--> statement-breakpoint
INSERT INTO `trip_expense_categories` (`org_id`, `name`, `active`) SELECT `id`, 'Other', 1 FROM `orgs`;
