import { getTelegramUid } from "../utils/telegram";

const API_URL = "https://umakler.com.ua/api";

export async function apiRequest(
  path: string,
  options: RequestInit = {}
) {
  const uid = getTelegramUid();
  let url = `${API_URL}${path}`;

  const method = options.method || "GET";

  // --- GET ---
  if (method === "GET" || method === "DELETE") {
    if (path.includes("?")) {
      url += `&uid=${uid}`;
    } else {
      url += `?uid=${uid}`;
    }
  }

  // --- POST / PUT ---
  if (method === "POST" || method === "PUT") {
    let body: any = {};

    if (options.body) {
      try {
        body = JSON.parse(options.body as string);
      } catch {
        body = {};
      }
    }

    body.uid = uid;

    options.body = JSON.stringify(body);
  }

  const res = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    },
    ...options
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "API error");
  }

  return res.json();
}
