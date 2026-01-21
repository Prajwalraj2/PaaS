CREATE TABLE "api_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"key_hash" varchar(255) NOT NULL,
	"prefix" varchar(20) NOT NULL,
	"last_used_at" timestamp,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "build_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"deployment_id" uuid NOT NULL,
	"timestamp" timestamp DEFAULT now() NOT NULL,
	"level" varchar(20) DEFAULT 'info' NOT NULL,
	"message" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "custom_domains" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"domain" varchar(255) NOT NULL,
	"verified" boolean DEFAULT false NOT NULL,
	"ssl_status" varchar(50) DEFAULT 'pending' NOT NULL,
	"verification_token" varchar(255),
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "custom_domains_domain_unique" UNIQUE("domain")
);
--> statement-breakpoint
CREATE TABLE "deployments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"git_commit_sha" varchar(100),
	"git_commit_message" varchar(500),
	"git_branch" varchar(255),
	"git_author" varchar(255),
	"build_status" varchar(50) DEFAULT 'queued' NOT NULL,
	"build_started_at" timestamp,
	"build_finished_at" timestamp,
	"build_duration_ms" integer,
	"image_tag" varchar(255),
	"image_size_bytes" bigint,
	"deploy_status" varchar(50) DEFAULT 'pending' NOT NULL,
	"deploy_started_at" timestamp,
	"deploy_finished_at" timestamp,
	"is_current" boolean DEFAULT false NOT NULL,
	"triggered_by" varchar(50),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "environment_variables" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"key" varchar(255) NOT NULL,
	"value" text NOT NULL,
	"is_secret" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"team_id" uuid,
	"name" varchar(255) NOT NULL,
	"slug" varchar(255) NOT NULL,
	"git_provider" varchar(50) NOT NULL,
	"git_repo_url" varchar(500) NOT NULL,
	"git_repo_id" varchar(100),
	"git_branch" varchar(255) DEFAULT 'main' NOT NULL,
	"git_root_dir" varchar(255) DEFAULT '/' NOT NULL,
	"build_command" varchar(500),
	"start_command" varchar(500),
	"dockerfile_path" varchar(255),
	"instance_type" varchar(50) DEFAULT 'small' NOT NULL,
	"instance_count" integer DEFAULT 1 NOT NULL,
	"port" integer DEFAULT 3000 NOT NULL,
	"status" varchar(50) DEFAULT 'inactive' NOT NULL,
	"subdomain" varchar(255),
	"k8s_namespace" varchar(255),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "projects_slug_unique" UNIQUE("slug"),
	CONSTRAINT "projects_subdomain_unique" UNIQUE("subdomain")
);
--> statement-breakpoint
CREATE TABLE "services" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"type" varchar(50) NOT NULL,
	"version" varchar(50),
	"host" varchar(255),
	"port" integer,
	"username" varchar(255),
	"password" text,
	"database_name" varchar(255),
	"connection_url" text,
	"k8s_service_name" varchar(255),
	"storage_gb" integer DEFAULT 1 NOT NULL,
	"status" varchar(50) DEFAULT 'provisioning' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token" varchar(500) NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "sessions_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"stripe_customer_id" varchar(255),
	"stripe_subscription_id" varchar(255),
	"plan" varchar(50) NOT NULL,
	"status" varchar(50) NOT NULL,
	"current_period_start" timestamp,
	"current_period_end" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "team_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" varchar(50) DEFAULT 'member' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "teams" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"slug" varchar(255) NOT NULL,
	"owner_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "teams_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "usage_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"date" date NOT NULL,
	"cpu_seconds" bigint DEFAULT 0 NOT NULL,
	"memory_gb_seconds" bigint DEFAULT 0 NOT NULL,
	"bandwidth_bytes" bigint DEFAULT 0 NOT NULL,
	"build_minutes" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"password_hash" varchar(255),
	"name" varchar(255),
	"avatar_url" varchar(500),
	"github_id" varchar(100),
	"plan" varchar(50) DEFAULT 'free' NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_github_id_unique" UNIQUE("github_id")
);
--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "build_logs" ADD CONSTRAINT "build_logs_deployment_id_deployments_id_fk" FOREIGN KEY ("deployment_id") REFERENCES "public"."deployments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "custom_domains" ADD CONSTRAINT "custom_domains_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deployments" ADD CONSTRAINT "deployments_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "environment_variables" ADD CONSTRAINT "environment_variables_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "services" ADD CONSTRAINT "services_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teams" ADD CONSTRAINT "teams_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_records" ADD CONSTRAINT "usage_records_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "api_keys_user_id_idx" ON "api_keys" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "build_logs_deployment_id_idx" ON "build_logs" USING btree ("deployment_id");--> statement-breakpoint
CREATE INDEX "build_logs_timestamp_idx" ON "build_logs" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX "custom_domains_project_id_idx" ON "custom_domains" USING btree ("project_id");--> statement-breakpoint
CREATE UNIQUE INDEX "custom_domains_domain_idx" ON "custom_domains" USING btree ("domain");--> statement-breakpoint
CREATE INDEX "deployments_project_id_idx" ON "deployments" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "deployments_created_at_idx" ON "deployments" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "deployments_is_current_idx" ON "deployments" USING btree ("is_current");--> statement-breakpoint
CREATE UNIQUE INDEX "env_vars_project_key_idx" ON "environment_variables" USING btree ("project_id","key");--> statement-breakpoint
CREATE INDEX "projects_user_id_idx" ON "projects" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "projects_team_id_idx" ON "projects" USING btree ("team_id");--> statement-breakpoint
CREATE INDEX "projects_status_idx" ON "projects" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "projects_slug_idx" ON "projects" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "services_project_id_idx" ON "services" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "sessions_user_id_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sessions_token_idx" ON "sessions" USING btree ("token");--> statement-breakpoint
CREATE INDEX "subscriptions_user_id_idx" ON "subscriptions" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "team_members_team_user_idx" ON "team_members" USING btree ("team_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "teams_slug_idx" ON "teams" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "teams_owner_id_idx" ON "teams" USING btree ("owner_id");--> statement-breakpoint
CREATE UNIQUE INDEX "usage_records_project_date_idx" ON "usage_records" USING btree ("project_id","date");--> statement-breakpoint
CREATE INDEX "usage_records_date_idx" ON "usage_records" USING btree ("date");--> statement-breakpoint
CREATE INDEX "users_email_idx" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "users_github_id_idx" ON "users" USING btree ("github_id");