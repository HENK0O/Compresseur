export function createContentDisposition(fileName: string) {
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
