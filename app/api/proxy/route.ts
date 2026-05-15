import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const payload = await req.json();
    const { url, headers, body, method } = payload;

    const response = await fetch(url, {
      method: method || "POST",
      headers: headers || { "Content-Type": "application/json" },
      body: typeof body === "string" ? body : JSON.stringify(body),
    });

    const data = await response.text();

    return new NextResponse(data, {
      status: response.status,
      headers: {
        "Content-Type": response.headers.get("Content-Type") || "application/json",
      },
    });
  } catch (error: any) {
    console.error("Proxy error:", error);
    return NextResponse.json(
      { error: error.message || "Proxy request failed (CORS or network error). Make sure the local server is running." },
      { status: 500 }
    );
  }
}
