import { NextRequest } from "next/server";
import { createContentDisposition } from "@/lib/download-response";
import { applyAudioEffect } from "@/lib/media-compression";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const entry = formData.get("file");

    if (!(entry instanceof File)) {
      return Response.json(
        { error: "Aucun fichier audio valide n'a ete envoye." },
        { status: 400 },
      );
    }

    const result = await applyAudioEffect(entry, formData);

    return new Response(new Uint8Array(result.buffer), {
      status: 200,
      headers: {
        "Content-Type": result.mimeType,
        "Content-Disposition": createContentDisposition(result.fileName),
        "X-Audio-Effect": result.effectLabel,
        "X-Original-Size": String(result.originalSize),
        "X-Compressed-Size": String(result.compressedSize),
      },
    });
  } catch (error) {
    console.error(error);

    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Le mod audio a echoue.",
      },
      { status: 500 },
    );
  }
}
