import type { Config } from "@netlify/functions";

// Session key — a random token stored in localStorage identifying this browser's cart/balance.
const KEY_NAME = "tigeres_key";

function makeKey(): string {
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export default async (req: Request, context: Context) => {
  const cookies = context.cookies;
  let key = cookies.get(KEY_NAME);

  if (!key || key.length < 16) {
    key = makeKey();
    cookies.set({
      name: KEY_NAME,
      value: key,
      path: "/",
      httpOnly: false,
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 365,
    });
  }

  return Response.json({ key });
};

export const config: Config = {
  path: "/api/session",
};
