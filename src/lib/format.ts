export function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB"];
  const power = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  );
  const value = bytes / 1024 ** power;

  return `${value.toFixed(value >= 10 || power === 0 ? 0 : 1)} ${units[power]}`;
}

export function formatPercent(value: number) {
  if (!Number.isFinite(value)) {
    return "0%";
  }

  return `${Math.max(0, Math.round(value))}%`;
}

export function inferKind(file: File | null) {
  if (!file) {
    return "unknown" as const;
  }

  const extension = file.name.split(".").pop()?.toLowerCase();

  if (file.type.startsWith("image/")) {
    return "image" as const;
  }

  if (file.type.startsWith("video/")) {
    return "video" as const;
  }

  if (file.type.startsWith("audio/") || extension === "mp3") {
    return "audio" as const;
  }

  return "unknown" as const;
}

export function makeDownloadName(originalName: string, mimeType: string) {
  const baseName = originalName.replace(/\.[^/.]+$/, "");
  const extension =
    mimeType === "audio/mpeg"
      ? "mp3"
      : (mimeType.split("/")[1]?.replace("jpeg", "jpg") ?? "bin");

  return `${baseName}-compressed.${extension}`;
}
