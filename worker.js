export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // CORS preflight support
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      });
    }

    // Only handle /listings for now
    if (url.pathname === "/listings") {
      return handleListings(request);
    }

    // Fallback
    return new Response("Not found", { status: 404 });
  },
};

// 👉 REPLACE THIS with your dad's real Craigslist RSS URL
const CRAIGSLIST_RSS_URL =
  "https://vancouver.craigslist.org/search/sss?userid=YOUR_USER_ID&format=rss";

async function handleListings(request) {
  try {
    const res = await fetch(CRAIGSLIST_RSS_URL);
    if (!res.ok) {
      return jsonResponse(
        { error: "Failed to fetch Craigslist RSS" },
        502
      );
    }

    const rssText = await res.text();

    // Parse <item> blocks
    const itemBlocks = [...rssText.matchAll(/<item>([\s\S]*?)<\/item>/g)];

    const items = itemBlocks.map((match) => {
      const block = match[1];

      const title =
        matchText(block, /<title><!\[CDATA\[(.*?)\]\]><\/title>/) ||
        matchText(block, /<title>(.*?)<\/title>/) ||
        "";

      const link = matchText(block, /<link>(.*?)<\/link>/) || "";

      const guid =
        matchText(block, /<guid.*?>(.*?)<\/guid>/) ||
        extractIdFromLink(link);

      const descriptionRaw =
        matchText(block, /<description><!\[CDATA\[(.*?)\]\]><\/description>/s) ||
        matchText(block, /<description>([\s\S]*?)<\/description>/) ||
        "";

      const description = stripHtml(descriptionRaw).trim();

      // Find first price like $350 or $1,498
      const priceMatch = descriptionRaw.match(/\$[\d,]+/);
      const price = priceMatch ? priceMatch[0] : null;

      // Grab any Craigslist image URLs
      const imageMatches = [
        ...descriptionRaw.matchAll(
          /https:\/\/images\.craigslist\.org\/[^\s"'<>]+\.jpg/gi
        ),
      ];
      const images = imageMatches.map((m) => m[0]);

      // Try to get posted date
      const pubDate = matchText(block, /<pubDate>(.*?)<\/pubDate>/) || null;

      return {
        id: guid || extractIdFromLink(link) || title, // fallback if no id
        title,
        link,
        description,
        price,
        images,
        pubDate,
      };
    });

    return jsonResponse({ items });
  } catch (err) {
    return jsonResponse(
      { error: "Unexpected error", details: String(err) },
      500
    );
  }
}

// ---------- helpers ----------

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

function matchText(block, regex) {
  const m = block.match(regex);
  return m ? m[1] : null;
}

function stripHtml(html) {
  // Remove tags and decode simple entities
  return html
    .replace(/<\/?[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ");
}

function extractIdFromLink(link) {
  if (!link) return null;
  // Craigslist links usually end with /1234567890.html
  const m = link.match(/\/(\d+)\.html/);
  return m ? m[1] : null;
}
