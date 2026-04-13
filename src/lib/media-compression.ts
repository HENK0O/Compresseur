import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import ffmpeg from "fluent-ffmpeg";
import ffmpegStatic from "ffmpeg-static";
import ffprobeStatic from "ffprobe-static";
import sharp from "sharp";

type ImageFormat = "preserve" | "webp" | "jpeg" | "png" | "avif";
type VideoQuality = "light" | "balanced" | "strong";

type CompressionResult = {
  buffer: Buffer;
  compressedSize: number;
  fileName: string;
  mimeType: string;
  originalSize: number;
  savedPercent: number;
};

type VideoProfile = {
  audioBitrate: string;
  crf: number;
  maxRate: string;
  bufferSize: string;
  preset: string;
};

const videoProfiles: Record<VideoQuality, VideoProfile> = {
  light: {
    audioBitrate: "160k",
    crf: 20,
    maxRate: "12M",
    bufferSize: "24M",
    preset: "slow",
  },
  balanced: {
    audioBitrate: "144k",
    crf: 23,
    maxRate: "8M",
    bufferSize: "16M",
    preset: "medium",
  },
  strong: {
    audioBitrate: "128k",
    crf: 27,
    maxRate: "5M",
    bufferSize: "10M",
    preset: "medium",
  },
};

if (typeof ffmpegStatic === "string") {
  ffmpeg.setFfmpegPath(ffmpegStatic);
}

if (ffprobeStatic.path) {
  ffmpeg.setFfprobePath(ffprobeStatic.path);
}

export async function compressMedia(file: File, formData: FormData) {
  const sourceBuffer = Buffer.from(await file.arrayBuffer());
  const originalSize = sourceBuffer.byteLength;

  if (file.type.startsWith("image/")) {
    const quality = parseNumber(formData.get("imageQuality"), 72);
    const format = parseImageFormat(formData.get("imageFormat"));

    return compressImage({
      buffer: sourceBuffer,
      fileName: file.name,
      format,
      mimeType: file.type,
      originalSize,
      quality,
    });
  }

  if (file.type.startsWith("video/")) {
    const quality = parseVideoQuality(formData.get("videoQuality"));
    const height = parseVideoHeight(formData.get("videoHeight"));

    return compressVideo({
      buffer: sourceBuffer,
      fileName: file.name,
      originalSize,
      quality,
      targetHeight: height,
    });
  }

  throw new Error("Ce type de fichier n'est pas encore pris en charge.");
}

async function compressImage({
  buffer,
  fileName,
  format,
  mimeType,
  originalSize,
  quality,
}: {
  buffer: Buffer;
  fileName: string;
  format: ImageFormat;
  mimeType: string;
  originalSize: number;
  quality: number;
}): Promise<CompressionResult> {
  const normalizedFormat = resolveImageFormat(format, mimeType);
  let pipeline = sharp(buffer, { animated: true }).rotate();

  if (normalizedFormat === "jpeg") {
    pipeline = pipeline.jpeg({ mozjpeg: true, quality });
  } else if (normalizedFormat === "png") {
    pipeline = pipeline.png({
      compressionLevel: 9,
      palette: true,
      quality,
    });
  } else if (normalizedFormat === "avif") {
    pipeline = pipeline.avif({ quality });
  } else {
    pipeline = pipeline.webp({ quality });
  }

  const outputBuffer = await pipeline.toBuffer();
  const extension = normalizedFormat === "jpeg" ? "jpg" : normalizedFormat;
  const outputName = `${stripExtension(fileName)}-compressed.${extension}`;

  return {
    buffer: outputBuffer,
    compressedSize: outputBuffer.byteLength,
    fileName: outputName,
    mimeType: `image/${normalizedFormat === "jpeg" ? "jpeg" : normalizedFormat}`,
    originalSize,
    savedPercent: calculateSavedPercent(originalSize, outputBuffer.byteLength),
  };
}

async function compressVideo({
  buffer,
  fileName,
  originalSize,
  quality,
  targetHeight,
}: {
  buffer: Buffer;
  fileName: string;
  originalSize: number;
  quality: VideoQuality;
  targetHeight: number | null;
}): Promise<CompressionResult> {
  const tempDirectory = await fs.mkdtemp(
    path.join(os.tmpdir(), "pulse-compress-"),
  );
  const inputExtension = path.extname(fileName) || ".mp4";
  const inputPath = path.join(tempDirectory, `${randomUUID()}${inputExtension}`);
  const outputName = `${stripExtension(fileName)}-compressed.mp4`;
  const outputPath = path.join(tempDirectory, outputName);
  const profile = videoProfiles[quality];

  try {
    await fs.writeFile(inputPath, buffer);

    const sourceHeight = await probeVideoHeight(inputPath);

    await new Promise<void>((resolve, reject) => {
      const command = ffmpeg(inputPath)
        .videoCodec("libx264")
        .audioCodec("aac")
        .format("mp4")
        .outputOptions([
          `-preset ${profile.preset}`,
          `-crf ${profile.crf}`,
          `-b:a ${profile.audioBitrate}`,
          `-maxrate ${profile.maxRate}`,
          `-bufsize ${profile.bufferSize}`,
          "-movflags +faststart",
          "-profile:v high",
          "-pix_fmt yuv420p",
        ])
        .on("end", () => resolve())
        .on("error", (error) => reject(error))
        .save(outputPath);

      if (targetHeight && sourceHeight && sourceHeight > targetHeight) {
        command.videoFilters(
          `scale=-2:${targetHeight}:flags=lanczos:force_original_aspect_ratio=decrease`,
        );
      }
    });

    const outputBuffer = await fs.readFile(outputPath);

    return {
      buffer: outputBuffer,
      compressedSize: outputBuffer.byteLength,
      fileName: outputName,
      mimeType: "video/mp4",
      originalSize,
      savedPercent: calculateSavedPercent(originalSize, outputBuffer.byteLength),
    };
  } finally {
    await fs.rm(tempDirectory, { force: true, recursive: true });
  }
}

async function probeVideoHeight(filePath: string) {
  return new Promise<number | null>((resolve) => {
    ffmpeg.ffprobe(filePath, (error, metadata) => {
      if (error) {
        resolve(null);
        return;
      }

      const videoStream = metadata.streams.find(
        (stream) => stream.codec_type === "video",
      );

      resolve(typeof videoStream?.height === "number" ? videoStream.height : null);
    });
  });
}

function resolveImageFormat(format: ImageFormat, mimeType: string) {
  if (format !== "preserve") {
    return format;
  }

  if (mimeType.includes("png")) {
    return "png";
  }

  if (mimeType.includes("avif")) {
    return "avif";
  }

  if (mimeType.includes("jpeg") || mimeType.includes("jpg")) {
    return "jpeg";
  }

  return "webp";
}

function calculateSavedPercent(originalSize: number, compressedSize: number) {
  if (originalSize <= 0) {
    return 0;
  }

  return Math.max(0, ((originalSize - compressedSize) / originalSize) * 100);
}

function parseNumber(value: FormDataEntryValue | null, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseImageFormat(value: FormDataEntryValue | null): ImageFormat {
  return value === "jpeg" ||
    value === "png" ||
    value === "webp" ||
    value === "avif" ||
    value === "preserve"
    ? value
    : "webp";
}

function parseVideoQuality(value: FormDataEntryValue | null): VideoQuality {
  return value === "light" || value === "strong" || value === "balanced"
    ? value
    : "balanced";
}

function parseVideoHeight(value: FormDataEntryValue | null) {
  if (value === "1080" || value === "720" || value === "480") {
    return Number(value);
  }

  return null;
}

function stripExtension(fileName: string) {
  return fileName.replace(/\.[^/.]+$/, "");
}
