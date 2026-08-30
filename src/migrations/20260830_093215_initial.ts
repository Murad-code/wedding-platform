import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_users_role" AS ENUM('admin', 'organiser', 'viewer');
  CREATE TYPE "public"."enum_invitation_parties_status" AS ENUM('pending', 'partial', 'complete');
  CREATE TYPE "public"."enum_guests_rsvp_status" AS ENUM('pending', 'attending', 'declined');
  CREATE TYPE "public"."enum_guests_age_group" AS ENUM('adult', 'child', 'infant');
  CREATE TYPE "public"."enum_tables_shape" AS ENUM('round', 'rectangle', 'head');
  CREATE TYPE "public"."enum_photo_groups_status" AS ENUM('queued', 'get_ready', 'now', 'completed', 'skipped');
  CREATE TYPE "public"."enum_itinerary_items_visibility" AS ENUM('public', 'guests', 'internal');
  CREATE TYPE "public"."enum_notifications_channel" AS ENUM('email', 'sms');
  CREATE TYPE "public"."enum_notifications_type" AS ENUM('photo.get-ready', 'photo.now');
  CREATE TYPE "public"."enum_notifications_status" AS ENUM('queued', 'sending', 'sent', 'failed');
  CREATE TYPE "public"."enum_audit_events_actor_type" AS ENUM('user', 'guest', 'system');
  CREATE TYPE "public"."enum_wedding_settings_enabled_features" AS ENUM('rsvp', 'menu', 'seating', 'itinerary', 'photoQueue', 'accommodation', 'travel', 'faqs', 'contacts', 'smsNotifications');
  CREATE TABLE "users_sessions" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"created_at" timestamp(3) with time zone,
  	"expires_at" timestamp(3) with time zone NOT NULL
  );
  
  CREATE TABLE "users" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"role" "enum_users_role" DEFAULT 'organiser' NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"email" varchar NOT NULL,
  	"reset_password_token" varchar,
  	"reset_password_expiration" timestamp(3) with time zone,
  	"salt" varchar,
  	"hash" varchar,
  	"login_attempts" numeric DEFAULT 0,
  	"lock_until" timestamp(3) with time zone
  );
  
  CREATE TABLE "invitation_parties" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"display_name" varchar NOT NULL,
  	"token_hash" varchar,
  	"token_version" numeric DEFAULT 1,
  	"status" "enum_invitation_parties_status" DEFAULT 'pending' NOT NULL,
  	"plus_ones_allowed" numeric DEFAULT 0,
  	"contact_email" varchar,
  	"contact_phone" varchar,
  	"message_to_couple" varchar,
  	"internal_notes" varchar,
  	"invited_at" timestamp(3) with time zone,
  	"responded_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "guests" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"first_name" varchar NOT NULL,
  	"last_name" varchar,
  	"party_id" integer NOT NULL,
  	"rsvp_status" "enum_guests_rsvp_status" DEFAULT 'pending' NOT NULL,
  	"age_group" "enum_guests_age_group" DEFAULT 'adult' NOT NULL,
  	"is_plus_one" boolean DEFAULT false,
  	"email" varchar,
  	"phone" varchar,
  	"sms_consent" boolean DEFAULT false,
  	"sms_consent_at" timestamp(3) with time zone,
  	"dietary_requirements" varchar,
  	"allergies" varchar,
  	"accessibility_needs" varchar,
  	"table_id" integer,
  	"internal_notes" varchar,
  	"responded_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "guests_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"tags_id" integer
  );
  
  CREATE TABLE "tags" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "tables" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"capacity" numeric DEFAULT 8 NOT NULL,
  	"shape" "enum_tables_shape" DEFAULT 'round' NOT NULL,
  	"order" numeric DEFAULT 0 NOT NULL,
  	"notes" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "menu_courses" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"description" varchar,
  	"order" numeric DEFAULT 0 NOT NULL,
  	"required" boolean DEFAULT true,
  	"children_only" boolean DEFAULT false,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "menu_options" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"description" varchar,
  	"course_id" integer NOT NULL,
  	"order" numeric DEFAULT 0 NOT NULL,
  	"is_vegetarian" boolean DEFAULT false,
  	"is_vegan" boolean DEFAULT false,
  	"is_gluten_free" boolean DEFAULT false,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "guest_meal_selections" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"guest_id" integer NOT NULL,
  	"course_id" integer NOT NULL,
  	"option_id" integer NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "photo_groups" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"description" varchar,
  	"estimated_minutes" numeric,
  	"order" numeric DEFAULT 0 NOT NULL,
  	"status" "enum_photo_groups_status" DEFAULT 'queued' NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "photo_groups_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"guests_id" integer
  );
  
  CREATE TABLE "itinerary_items" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"order" numeric DEFAULT 0 NOT NULL,
  	"start_time" timestamp(3) with time zone,
  	"end_time" timestamp(3) with time zone,
  	"location" varchar,
  	"description" varchar,
  	"visibility" "enum_itinerary_items_visibility" DEFAULT 'guests' NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "wedding_contacts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"role" varchar,
  	"order" numeric DEFAULT 0 NOT NULL,
  	"phone" varchar,
  	"whatsapp" varchar,
  	"email" varchar,
  	"visible_to_guests" boolean DEFAULT false,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "media" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"alt" varchar NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"url" varchar,
  	"thumbnail_u_r_l" varchar,
  	"filename" varchar,
  	"mime_type" varchar,
  	"filesize" numeric,
  	"width" numeric,
  	"height" numeric,
  	"focal_x" numeric,
  	"focal_y" numeric
  );
  
  CREATE TABLE "notifications" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"guest_id" integer NOT NULL,
  	"dedupe_key" varchar NOT NULL,
  	"channel" "enum_notifications_channel" NOT NULL,
  	"type" "enum_notifications_type" NOT NULL,
  	"provider" varchar,
  	"status" "enum_notifications_status" DEFAULT 'queued' NOT NULL,
  	"subject" varchar,
  	"body" varchar NOT NULL,
  	"provider_message_id" varchar,
  	"attempts" numeric DEFAULT 0 NOT NULL,
  	"last_attempt_at" timestamp(3) with time zone,
  	"next_attempt_at" timestamp(3) with time zone,
  	"error" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "audit_events" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"action" varchar NOT NULL,
  	"actor_type" "enum_audit_events_actor_type" DEFAULT 'system' NOT NULL,
  	"actor_user_id" integer,
  	"entity_type" varchar,
  	"entity_id" varchar,
  	"metadata" jsonb,
  	"ip_hash" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload_kv" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar NOT NULL,
  	"data" jsonb NOT NULL
  );
  
  CREATE TABLE "payload_locked_documents" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"global_slug" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload_locked_documents_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" integer,
  	"invitation_parties_id" integer,
  	"guests_id" integer,
  	"tags_id" integer,
  	"tables_id" integer,
  	"menu_courses_id" integer,
  	"menu_options_id" integer,
  	"guest_meal_selections_id" integer,
  	"photo_groups_id" integer,
  	"itinerary_items_id" integer,
  	"wedding_contacts_id" integer,
  	"media_id" integer,
  	"notifications_id" integer,
  	"audit_events_id" integer
  );
  
  CREATE TABLE "payload_preferences" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar,
  	"value" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload_preferences_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" integer
  );
  
  CREATE TABLE "payload_migrations" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar,
  	"batch" numeric,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "wedding_settings_faqs" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"question" varchar NOT NULL,
  	"answer" varchar NOT NULL
  );
  
  CREATE TABLE "wedding_settings_enabled_features" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum_wedding_settings_enabled_features",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "wedding_settings" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"partner_one_name" varchar NOT NULL,
  	"partner_two_name" varchar NOT NULL,
  	"wedding_date" timestamp(3) with time zone NOT NULL,
  	"timezone" varchar DEFAULT 'Europe/London' NOT NULL,
  	"rsvp_deadline" timestamp(3) with time zone,
  	"dress_code" varchar,
  	"welcome_message" varchar,
  	"hero_image_id" integer,
  	"ceremony_venue_name" varchar,
  	"ceremony_address" varchar,
  	"ceremony_map_url" varchar,
  	"ceremony_start_time" timestamp(3) with time zone,
  	"ceremony_notes" varchar,
  	"reception_venue_name" varchar,
  	"reception_address" varchar,
  	"reception_map_url" varchar,
  	"reception_start_time" timestamp(3) with time zone,
  	"reception_notes" varchar,
  	"travel_information" varchar,
  	"parking_information" varchar,
  	"accommodation_information" varchar,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "photo_queue_state" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"revision" numeric DEFAULT 0 NOT NULL,
  	"last_action_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  ALTER TABLE "users_sessions" ADD CONSTRAINT "users_sessions_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "guests" ADD CONSTRAINT "guests_party_id_invitation_parties_id_fk" FOREIGN KEY ("party_id") REFERENCES "public"."invitation_parties"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "guests" ADD CONSTRAINT "guests_table_id_tables_id_fk" FOREIGN KEY ("table_id") REFERENCES "public"."tables"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "guests_rels" ADD CONSTRAINT "guests_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."guests"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "guests_rels" ADD CONSTRAINT "guests_rels_tags_fk" FOREIGN KEY ("tags_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "menu_options" ADD CONSTRAINT "menu_options_course_id_menu_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."menu_courses"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "guest_meal_selections" ADD CONSTRAINT "guest_meal_selections_guest_id_guests_id_fk" FOREIGN KEY ("guest_id") REFERENCES "public"."guests"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "guest_meal_selections" ADD CONSTRAINT "guest_meal_selections_course_id_menu_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."menu_courses"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "guest_meal_selections" ADD CONSTRAINT "guest_meal_selections_option_id_menu_options_id_fk" FOREIGN KEY ("option_id") REFERENCES "public"."menu_options"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "photo_groups_rels" ADD CONSTRAINT "photo_groups_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."photo_groups"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "photo_groups_rels" ADD CONSTRAINT "photo_groups_rels_guests_fk" FOREIGN KEY ("guests_id") REFERENCES "public"."guests"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "notifications" ADD CONSTRAINT "notifications_guest_id_guests_id_fk" FOREIGN KEY ("guest_id") REFERENCES "public"."guests"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."payload_locked_documents"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_invitation_parties_fk" FOREIGN KEY ("invitation_parties_id") REFERENCES "public"."invitation_parties"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_guests_fk" FOREIGN KEY ("guests_id") REFERENCES "public"."guests"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_tags_fk" FOREIGN KEY ("tags_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_tables_fk" FOREIGN KEY ("tables_id") REFERENCES "public"."tables"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_menu_courses_fk" FOREIGN KEY ("menu_courses_id") REFERENCES "public"."menu_courses"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_menu_options_fk" FOREIGN KEY ("menu_options_id") REFERENCES "public"."menu_options"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_guest_meal_selections_fk" FOREIGN KEY ("guest_meal_selections_id") REFERENCES "public"."guest_meal_selections"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_photo_groups_fk" FOREIGN KEY ("photo_groups_id") REFERENCES "public"."photo_groups"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_itinerary_items_fk" FOREIGN KEY ("itinerary_items_id") REFERENCES "public"."itinerary_items"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_wedding_contacts_fk" FOREIGN KEY ("wedding_contacts_id") REFERENCES "public"."wedding_contacts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_media_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_notifications_fk" FOREIGN KEY ("notifications_id") REFERENCES "public"."notifications"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_audit_events_fk" FOREIGN KEY ("audit_events_id") REFERENCES "public"."audit_events"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."payload_preferences"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "wedding_settings_faqs" ADD CONSTRAINT "wedding_settings_faqs_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."wedding_settings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "wedding_settings_enabled_features" ADD CONSTRAINT "wedding_settings_enabled_features_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."wedding_settings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "wedding_settings" ADD CONSTRAINT "wedding_settings_hero_image_id_media_id_fk" FOREIGN KEY ("hero_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "users_sessions_order_idx" ON "users_sessions" USING btree ("_order");
  CREATE INDEX "users_sessions_parent_id_idx" ON "users_sessions" USING btree ("_parent_id");
  CREATE INDEX "users_updated_at_idx" ON "users" USING btree ("updated_at");
  CREATE INDEX "users_created_at_idx" ON "users" USING btree ("created_at");
  CREATE UNIQUE INDEX "users_email_idx" ON "users" USING btree ("email");
  CREATE INDEX "invitation_parties_display_name_idx" ON "invitation_parties" USING btree ("display_name");
  CREATE UNIQUE INDEX "invitation_parties_token_hash_idx" ON "invitation_parties" USING btree ("token_hash");
  CREATE INDEX "invitation_parties_status_idx" ON "invitation_parties" USING btree ("status");
  CREATE INDEX "invitation_parties_updated_at_idx" ON "invitation_parties" USING btree ("updated_at");
  CREATE INDEX "invitation_parties_created_at_idx" ON "invitation_parties" USING btree ("created_at");
  CREATE INDEX "guests_party_idx" ON "guests" USING btree ("party_id");
  CREATE INDEX "guests_rsvp_status_idx" ON "guests" USING btree ("rsvp_status");
  CREATE INDEX "guests_sms_consent_idx" ON "guests" USING btree ("sms_consent");
  CREATE INDEX "guests_table_idx" ON "guests" USING btree ("table_id");
  CREATE INDEX "guests_updated_at_idx" ON "guests" USING btree ("updated_at");
  CREATE INDEX "guests_created_at_idx" ON "guests" USING btree ("created_at");
  CREATE INDEX "guests_rels_order_idx" ON "guests_rels" USING btree ("order");
  CREATE INDEX "guests_rels_parent_idx" ON "guests_rels" USING btree ("parent_id");
  CREATE INDEX "guests_rels_path_idx" ON "guests_rels" USING btree ("path");
  CREATE INDEX "guests_rels_tags_id_idx" ON "guests_rels" USING btree ("tags_id");
  CREATE UNIQUE INDEX "tags_name_idx" ON "tags" USING btree ("name");
  CREATE INDEX "tags_updated_at_idx" ON "tags" USING btree ("updated_at");
  CREATE INDEX "tags_created_at_idx" ON "tags" USING btree ("created_at");
  CREATE UNIQUE INDEX "tables_name_idx" ON "tables" USING btree ("name");
  CREATE INDEX "tables_order_idx" ON "tables" USING btree ("order");
  CREATE INDEX "tables_updated_at_idx" ON "tables" USING btree ("updated_at");
  CREATE INDEX "tables_created_at_idx" ON "tables" USING btree ("created_at");
  CREATE INDEX "menu_courses_order_idx" ON "menu_courses" USING btree ("order");
  CREATE INDEX "menu_courses_updated_at_idx" ON "menu_courses" USING btree ("updated_at");
  CREATE INDEX "menu_courses_created_at_idx" ON "menu_courses" USING btree ("created_at");
  CREATE INDEX "menu_options_course_idx" ON "menu_options" USING btree ("course_id");
  CREATE INDEX "menu_options_order_idx" ON "menu_options" USING btree ("order");
  CREATE INDEX "menu_options_updated_at_idx" ON "menu_options" USING btree ("updated_at");
  CREATE INDEX "menu_options_created_at_idx" ON "menu_options" USING btree ("created_at");
  CREATE INDEX "guest_meal_selections_guest_idx" ON "guest_meal_selections" USING btree ("guest_id");
  CREATE INDEX "guest_meal_selections_course_idx" ON "guest_meal_selections" USING btree ("course_id");
  CREATE INDEX "guest_meal_selections_option_idx" ON "guest_meal_selections" USING btree ("option_id");
  CREATE INDEX "guest_meal_selections_updated_at_idx" ON "guest_meal_selections" USING btree ("updated_at");
  CREATE INDEX "guest_meal_selections_created_at_idx" ON "guest_meal_selections" USING btree ("created_at");
  CREATE UNIQUE INDEX "guest_course_idx" ON "guest_meal_selections" USING btree ("guest_id","course_id");
  CREATE UNIQUE INDEX "photo_groups_name_idx" ON "photo_groups" USING btree ("name");
  CREATE INDEX "photo_groups_order_idx" ON "photo_groups" USING btree ("order");
  CREATE INDEX "photo_groups_status_idx" ON "photo_groups" USING btree ("status");
  CREATE INDEX "photo_groups_updated_at_idx" ON "photo_groups" USING btree ("updated_at");
  CREATE INDEX "photo_groups_created_at_idx" ON "photo_groups" USING btree ("created_at");
  CREATE INDEX "photo_groups_rels_order_idx" ON "photo_groups_rels" USING btree ("order");
  CREATE INDEX "photo_groups_rels_parent_idx" ON "photo_groups_rels" USING btree ("parent_id");
  CREATE INDEX "photo_groups_rels_path_idx" ON "photo_groups_rels" USING btree ("path");
  CREATE INDEX "photo_groups_rels_guests_id_idx" ON "photo_groups_rels" USING btree ("guests_id");
  CREATE INDEX "itinerary_items_order_idx" ON "itinerary_items" USING btree ("order");
  CREATE INDEX "itinerary_items_updated_at_idx" ON "itinerary_items" USING btree ("updated_at");
  CREATE INDEX "itinerary_items_created_at_idx" ON "itinerary_items" USING btree ("created_at");
  CREATE INDEX "wedding_contacts_order_idx" ON "wedding_contacts" USING btree ("order");
  CREATE INDEX "wedding_contacts_updated_at_idx" ON "wedding_contacts" USING btree ("updated_at");
  CREATE INDEX "wedding_contacts_created_at_idx" ON "wedding_contacts" USING btree ("created_at");
  CREATE INDEX "media_updated_at_idx" ON "media" USING btree ("updated_at");
  CREATE INDEX "media_created_at_idx" ON "media" USING btree ("created_at");
  CREATE UNIQUE INDEX "media_filename_idx" ON "media" USING btree ("filename");
  CREATE INDEX "notifications_guest_idx" ON "notifications" USING btree ("guest_id");
  CREATE UNIQUE INDEX "notifications_dedupe_key_idx" ON "notifications" USING btree ("dedupe_key");
  CREATE INDEX "notifications_type_idx" ON "notifications" USING btree ("type");
  CREATE INDEX "notifications_status_idx" ON "notifications" USING btree ("status");
  CREATE INDEX "notifications_next_attempt_at_idx" ON "notifications" USING btree ("next_attempt_at");
  CREATE INDEX "notifications_updated_at_idx" ON "notifications" USING btree ("updated_at");
  CREATE INDEX "notifications_created_at_idx" ON "notifications" USING btree ("created_at");
  CREATE INDEX "audit_events_action_idx" ON "audit_events" USING btree ("action");
  CREATE INDEX "audit_events_actor_user_idx" ON "audit_events" USING btree ("actor_user_id");
  CREATE INDEX "audit_events_entity_type_idx" ON "audit_events" USING btree ("entity_type");
  CREATE INDEX "audit_events_updated_at_idx" ON "audit_events" USING btree ("updated_at");
  CREATE INDEX "audit_events_created_at_idx" ON "audit_events" USING btree ("created_at");
  CREATE UNIQUE INDEX "payload_kv_key_idx" ON "payload_kv" USING btree ("key");
  CREATE INDEX "payload_locked_documents_global_slug_idx" ON "payload_locked_documents" USING btree ("global_slug");
  CREATE INDEX "payload_locked_documents_updated_at_idx" ON "payload_locked_documents" USING btree ("updated_at");
  CREATE INDEX "payload_locked_documents_created_at_idx" ON "payload_locked_documents" USING btree ("created_at");
  CREATE INDEX "payload_locked_documents_rels_order_idx" ON "payload_locked_documents_rels" USING btree ("order");
  CREATE INDEX "payload_locked_documents_rels_parent_idx" ON "payload_locked_documents_rels" USING btree ("parent_id");
  CREATE INDEX "payload_locked_documents_rels_path_idx" ON "payload_locked_documents_rels" USING btree ("path");
  CREATE INDEX "payload_locked_documents_rels_users_id_idx" ON "payload_locked_documents_rels" USING btree ("users_id");
  CREATE INDEX "payload_locked_documents_rels_invitation_parties_id_idx" ON "payload_locked_documents_rels" USING btree ("invitation_parties_id");
  CREATE INDEX "payload_locked_documents_rels_guests_id_idx" ON "payload_locked_documents_rels" USING btree ("guests_id");
  CREATE INDEX "payload_locked_documents_rels_tags_id_idx" ON "payload_locked_documents_rels" USING btree ("tags_id");
  CREATE INDEX "payload_locked_documents_rels_tables_id_idx" ON "payload_locked_documents_rels" USING btree ("tables_id");
  CREATE INDEX "payload_locked_documents_rels_menu_courses_id_idx" ON "payload_locked_documents_rels" USING btree ("menu_courses_id");
  CREATE INDEX "payload_locked_documents_rels_menu_options_id_idx" ON "payload_locked_documents_rels" USING btree ("menu_options_id");
  CREATE INDEX "payload_locked_documents_rels_guest_meal_selections_id_idx" ON "payload_locked_documents_rels" USING btree ("guest_meal_selections_id");
  CREATE INDEX "payload_locked_documents_rels_photo_groups_id_idx" ON "payload_locked_documents_rels" USING btree ("photo_groups_id");
  CREATE INDEX "payload_locked_documents_rels_itinerary_items_id_idx" ON "payload_locked_documents_rels" USING btree ("itinerary_items_id");
  CREATE INDEX "payload_locked_documents_rels_wedding_contacts_id_idx" ON "payload_locked_documents_rels" USING btree ("wedding_contacts_id");
  CREATE INDEX "payload_locked_documents_rels_media_id_idx" ON "payload_locked_documents_rels" USING btree ("media_id");
  CREATE INDEX "payload_locked_documents_rels_notifications_id_idx" ON "payload_locked_documents_rels" USING btree ("notifications_id");
  CREATE INDEX "payload_locked_documents_rels_audit_events_id_idx" ON "payload_locked_documents_rels" USING btree ("audit_events_id");
  CREATE INDEX "payload_preferences_key_idx" ON "payload_preferences" USING btree ("key");
  CREATE INDEX "payload_preferences_updated_at_idx" ON "payload_preferences" USING btree ("updated_at");
  CREATE INDEX "payload_preferences_created_at_idx" ON "payload_preferences" USING btree ("created_at");
  CREATE INDEX "payload_preferences_rels_order_idx" ON "payload_preferences_rels" USING btree ("order");
  CREATE INDEX "payload_preferences_rels_parent_idx" ON "payload_preferences_rels" USING btree ("parent_id");
  CREATE INDEX "payload_preferences_rels_path_idx" ON "payload_preferences_rels" USING btree ("path");
  CREATE INDEX "payload_preferences_rels_users_id_idx" ON "payload_preferences_rels" USING btree ("users_id");
  CREATE INDEX "payload_migrations_updated_at_idx" ON "payload_migrations" USING btree ("updated_at");
  CREATE INDEX "payload_migrations_created_at_idx" ON "payload_migrations" USING btree ("created_at");
  CREATE INDEX "wedding_settings_faqs_order_idx" ON "wedding_settings_faqs" USING btree ("_order");
  CREATE INDEX "wedding_settings_faqs_parent_id_idx" ON "wedding_settings_faqs" USING btree ("_parent_id");
  CREATE INDEX "wedding_settings_enabled_features_order_idx" ON "wedding_settings_enabled_features" USING btree ("order");
  CREATE INDEX "wedding_settings_enabled_features_parent_idx" ON "wedding_settings_enabled_features" USING btree ("parent_id");
  CREATE INDEX "wedding_settings_hero_image_idx" ON "wedding_settings" USING btree ("hero_image_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "users_sessions" CASCADE;
  DROP TABLE "users" CASCADE;
  DROP TABLE "invitation_parties" CASCADE;
  DROP TABLE "guests" CASCADE;
  DROP TABLE "guests_rels" CASCADE;
  DROP TABLE "tags" CASCADE;
  DROP TABLE "tables" CASCADE;
  DROP TABLE "menu_courses" CASCADE;
  DROP TABLE "menu_options" CASCADE;
  DROP TABLE "guest_meal_selections" CASCADE;
  DROP TABLE "photo_groups" CASCADE;
  DROP TABLE "photo_groups_rels" CASCADE;
  DROP TABLE "itinerary_items" CASCADE;
  DROP TABLE "wedding_contacts" CASCADE;
  DROP TABLE "media" CASCADE;
  DROP TABLE "notifications" CASCADE;
  DROP TABLE "audit_events" CASCADE;
  DROP TABLE "payload_kv" CASCADE;
  DROP TABLE "payload_locked_documents" CASCADE;
  DROP TABLE "payload_locked_documents_rels" CASCADE;
  DROP TABLE "payload_preferences" CASCADE;
  DROP TABLE "payload_preferences_rels" CASCADE;
  DROP TABLE "payload_migrations" CASCADE;
  DROP TABLE "wedding_settings_faqs" CASCADE;
  DROP TABLE "wedding_settings_enabled_features" CASCADE;
  DROP TABLE "wedding_settings" CASCADE;
  DROP TABLE "photo_queue_state" CASCADE;
  DROP TYPE "public"."enum_users_role";
  DROP TYPE "public"."enum_invitation_parties_status";
  DROP TYPE "public"."enum_guests_rsvp_status";
  DROP TYPE "public"."enum_guests_age_group";
  DROP TYPE "public"."enum_tables_shape";
  DROP TYPE "public"."enum_photo_groups_status";
  DROP TYPE "public"."enum_itinerary_items_visibility";
  DROP TYPE "public"."enum_notifications_channel";
  DROP TYPE "public"."enum_notifications_type";
  DROP TYPE "public"."enum_notifications_status";
  DROP TYPE "public"."enum_audit_events_actor_type";
  DROP TYPE "public"."enum_wedding_settings_enabled_features";`)
}
