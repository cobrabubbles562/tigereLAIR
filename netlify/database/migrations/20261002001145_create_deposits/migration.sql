CREATE TABLE "deposits" (
	"id" serial PRIMARY KEY,
	"session_key" text NOT NULL,
	"usd_amount" numeric(12,2) NOT NULL,
	"coin" text NOT NULL,
	"coin_amount" numeric(24,10) NOT NULL,
	"address" text NOT NULL,
	"status" text DEFAULT 'not fulfilled' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"fulfilled_at" timestamp with time zone
);
