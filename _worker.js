const ROUTES = {
  "/identity": { pillar: "https://x402-idp.pages.dev", fee: "0.005", wallet: "0x6dD4821fE0e237aC59CB25669f969e9673E9F19F", chain: "base" },
  "/schema":   { pillar: "https://x402-scp.pages.dev", fee: "0.001", wallet: "0x6dD4821fE0e237aC59CB25669f969e9673E9F19F", chain: "base" },
  "/arb":      { pillar: "https://x402-arb.pages.dev", fee: "0.02",  wallet: "0x6dD4821fE0e237aC59CB25669f969e9673E9F19F", chain: "base" }
};

const SOL_ROUTES = {
  "/identity": { wallet: "4uGHtowXhJAkSeq8wocWzje7p3SV7hhRGxsC1DGLoLgL", fee: "0.005" },
  "/schema":   { wallet: "4uGHtowXhJAkSeq8wocWzje7p3SV7hhRGxsC1DGLoLgL", fee: "0.001" },
  "/arb":      { wallet: "4uGHtowXhJAkSeq8wocWzje7p3SV7hhRGxsC1DGLoLgL", fee: "0.02"  }
};

const FACILITATOR = "https://x402.org/facilitator";
const TTL = 300000;
const seen = new Map();

function clean() {
  const now = Date.now();
  for (const [k, t] of seen) if (now - t > TTL) seen.delete(k);
}

export default {
  async fetch(req) {
    const url = new URL(req.url);
    const path = url.pathname;

    if (path === "/" || path === "/llms.txt") {
      const res = await fetch("https://x402-idp.pages.dev/");
      const idp = await res.text();
      const res2 = await fetch("https://x402-scp.pages.dev/");
      const scp = await res2.text();
      const res3 = await fetch("https://x402-arb.pages.dev/");
      const arb = await res3.text();
      return new Response(idp + "\n\n" + scp + "\n\n" + arb, {
        headers: { "content-type": "text/plain" }
      });
    }

    const route = ROUTES[path];
    if (!route) return new Response("NOT_FOUND", { status: 404 });

    const sig = req.headers.get("PAYMENT-SIGNATURE");
    if (!sig) return new Response("PAYMENT_REQUIRED", {
      status: 402,
      headers: {
        "x402-fee": route.fee,
        "x402-asset": "usdc",
        "x402-chain": route.chain,
        "x402-wallet": route.wallet,
        "x402-sol-wallet": SOL_ROUTES[path].wallet,
        "x402-facilitator": FACILITATOR
      }
    });

    clean();
    const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(sig));
    const hex = [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2, "0")).join("");
    if (seen.has(hex)) return new Response("PAYMENT_REPLAYED", { status: 402 });
    seen.set(hex, Date.now());

    const verify = await fetch(FACILITATOR + "/verify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ signature: sig, fee: route.fee, asset: "usdc", chain: route.chain, wallet: route.wallet })
    });
    if (!verify.ok) return new Response("PAYMENT_INVALID", { status: 402 });

    const pillar = await fetch(route.pillar);
    return new Response(pillar.body, { headers: pillar.headers });
  }
};
