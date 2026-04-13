import { NextRequest } from "next/server";
import { compressMedia } from "@/lib/media-compression";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const entry = formData.get("file");

    if (!(entry instanceof File)) {
      return Response.json(
        { error: "Aucun fichier valide n'a ete envoye." },
        { status: 400 },
      );
    }

    const result = await compressMedia(entry, formData);

    return new Response(new Uint8Array(result.buffer), {
      status: 200,
      headers: {
        "Content-Type": result.mimeType,
        "Content-Disposition": createContentDisposition(result.fileName),
        "X-Original-Size": String(result.originalSize),
        "X-Compressed-Size": String(result.compressedSize),
        "X-Saved-Percent": result.savedPercent.toFixed(2),
      },
    });
  } catch (error) {
    console.error(error);

    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "La compression a echoue.",
      },
      { status: 500 },
    );
  }
}

function createContentDisposition(fileName: string) {
  const fallbackName = toAsciiFileName(fileName);
  const encodedName = encodeURIComponent(fileName)
    .replace(/['()]/g, escape)
    .replace(/\*/g, "%2A");

  return `attachment; filename="${fallbackName}"; filename*=UTF-8''${encodedName}`;
}

function toAsciiFileName(fileName: string) {
  const asciiName = fileName
    .normalize("NFKD")
    .replace(/[^\x20-\x7E]+/g, "_")
    .replace(/["\\]/g, "_")
    .replace(/\s+/g, " ")
    .trim();

  return asciiName || "download.bin";
}
