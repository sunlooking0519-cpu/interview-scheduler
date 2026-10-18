import "server-only";

export const CARD_MAX_BYTES = 10 * 1024 * 1024;

export function isSupportedCardImage(bytes: Buffer): boolean {
  const jpeg = bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const png = bytes.length > 8 && bytes.subarray(0, 8).equals(Buffer.from("89504e470d0a1a0a", "hex"));
  const webp = bytes.length > 12 && bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP";
  return jpeg || png || webp;
}

export async function recognizeBusinessCardWithVision(bytes: Buffer, request = fetch): Promise<string> {
  const apiKey = process.env.GOOGLE_VISION_API_KEY;
  if (!apiKey) throw new Error("VISION_NOT_CONFIGURED");
  const response = await request("https://vision.googleapis.com/v1/images:annotate", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify({ requests: [{ image: { content: bytes.toString("base64") }, features: [{ type: "DOCUMENT_TEXT_DETECTION" }], imageContext: { languageHints: ["ko", "en"] } }] }),
    signal: AbortSignal.timeout(20000),
    cache: "no-store",
  });
  if (!response.ok) throw new Error("VISION_REQUEST_FAILED");
  const payload = await response.json() as { responses?: { fullTextAnnotation?: { text?: string }; textAnnotations?: { description?: string }[]; error?: { code?: number } }[] };
  const first = payload.responses?.[0];
  if (first?.error) throw new Error("VISION_REQUEST_FAILED");
  return (first?.fullTextAnnotation?.text ?? first?.textAnnotations?.[0]?.description ?? "").trim().slice(0, 20000);
}
