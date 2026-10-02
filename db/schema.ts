import { pgTable, serial, text, timestamp, numeric } from "drizzle-orm/pg-core";

export const deposits = pgTable("deposits", {
  id: serial("id").primaryKey(),
  sessionKey: text("session_key").notNull(),
  usdAmount: numeric("usd_amount", { precision: 12, scale: 2 }).notNull(),
  coin: text("coin").notNull(),
  coinAmount: numeric("coin_amount", { precision: 24, scale: 10 }).notNull(),
  address: text("address").notNull(),
  status: text("status").notNull().default("not fulfilled"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  fulfilledAt: timestamp("fulfilled_at", { withTimezone: true }),
});
