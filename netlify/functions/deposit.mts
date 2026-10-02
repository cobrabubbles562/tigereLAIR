import type { Config } from "@netlify/functions";
import { db } from "../../db/index.js";
import { deposits } from "../../db/schema.js";
import { eq, desc } from "drizzle-orm";

// Wallet addresses — kept server-side so the page source never ships them.
const ADDRESSES: Record<string, string> = {
  sol: "CBAqzgSsDmFPkMkEvL36aS3XbPrjSeWiFzK1sshWzeqv",
  eth: "0xb6673e540A93Ed8585C2E2fd157766e8e1801045",
  btc: "bc1qsks6msamfnnl9zfgxlnhvgg4wxqqw7snlxp4kc",
};

const SYMBOLS: Record<string, string> = { sol: "solana", eth: "ethereum", btc: "bitcoin" };

// Fallback rates (USD per coin) if the live price API is unreachable.
const FALLBACK_RATES: Record<string, number> = { sol: 152.4, eth: 3180.55, btc: 68420.1 };

async function fetchRates(): Promise<Record<string, number>> {
  try {
    const ids = Object.values(SYMBOLS).join(",");
    const res = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`,
      { signal: AbortSignal.timeout(6000) },
    );
    if (!res.ok) throw new Error(`price api ${res.status}`);
    const data = (await res.json()) as Record<string, { usd: number }>;
    const rates: Record<string, number> = {};
    for (const [coin, id] of Object.entries(SYMBOLS)) {
      const usd = data[id]?.usd;
      if (typeof usd !== "number" || usd <= 0) throw new Error(`missing rate for ${coin}`);
      rates[coin] = usd;
    }
    return rates;
  } catch {
    return FALLBACK_RATES;
  }
}

const json = (data: unknown, status = 200) =>
  Response.json(data, { status, headers: { "Cache-Control": "no-store" } });

export default async (req: Request) => {
  const url = new URL(req.url);
  const path = url.pathname;

  // Live rates for the deposit page.
  if (req.method === "GET" && path === "/api/rates") {
    const rates = await fetchRates();
    return Response.json(rates, { headers: { "Cache-Control": "public, max-age=60" } });
  }

  // Deposit address for a coin (no side effects).
  if (req.method === "GET" && path.startsWith("/api/address/")) {
    const coin = path.slice("/api/address/".length).toLowerCase();
    if (!(coin in ADDRESSES)) return json({ error: "Unsupported coin" }, 404);
    return json({ coin, address: ADDRESSES[coin] });
  }

  // Record a deposit intent.
  if (req.method === "POST" && path === "/api/deposit") {
    let body: { usd?: unknown; coin?: unknown; key?: unknown };
    try {
      body = await req.json();
    } catch {
      return json({ error: "Invalid JSON body" }, 400);
    }

    const usd = Number(body.usd);
    const coin = String(body.coin ?? "").toLowerCase();
    const key = String(body.key ?? "").trim();

    if (!Number.isFinite(usd) || usd < 10 || usd > 10000) {
      return json({ error: "Amount must be between $10 and $10,000" }, 400);
    }
    if (!(coin in ADDRESSES)) return json({ error: "Unsupported coin" }, 400);
    if (!key) return json({ error: "Missing session key" }, 400);

    const rates = await fetchRates();
    const coinAmount = usd / rates[coin];

    try {
      const [row] = await db
        .insert(deposits)
        .values({
          sessionKey: key,
          usdAmount: usd.toFixed(2),
          coin,
          coinAmount: coinAmount.toFixed(10),
          address: ADDRESSES[coin],
        })
        .returning({ id: deposits.id });

      return json(
        {
          id: row.id,
          coin,
          coinAmount,
          usd,
          rate: rates[coin],
          address: ADDRESSES[coin],
          status: "not fulfilled",
        },
        201,
      );
    } catch (err) {
      console.error("deposit insert failed:", err);
      return json({ error: "Could not record the deposit — try again shortly." }, 500);
    }
  }

  // Deposit history for a session key.
  if (req.method === "GET" && path.startsWith("/api/deposits/")) {
    const key = decodeURIComponent(path.slice("/api/deposits/".length)).trim();
    if (!key) return json({ error: "Missing key" }, 400);
    try {
      const rows = await db
        .select()
        .from(deposits)
        .where(eq(deposits.sessionKey, key))
        .orderBy(desc(deposits.createdAt))
        .limit(25);
      return json(rows);
    } catch (err) {
      console.error("deposit history failed:", err);
      return json([]);
    }
  }

  return json({ error: "Method not allowed" }, 405);
};

export const config: Config = {
  path: ["/api/deposit", "/api/rates", "/api/address/*", "/api/deposits/*"],
};
