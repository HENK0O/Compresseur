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
type AudioQuality = "high" | "balanced" | "compact";
export type AudioEffectId =
  | "helium"
  | "deep"
  | "robot"
  | "radio"
  | "cave"
  | "vapor"
  | "glitch"
  | "telephone"
  | "underwater"
  | "wide";

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

type AudioProfile = {
  bitrate: string;
  sampleRate: number;
};

type AudioEffectProfile = {
  filter: string;
  label: string;
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

const audioProfiles: Record<AudioQuality, AudioProfile> = {
  high: { bitrate: "192k", sampleRate: 44100 },
  balanced: { bitrate: "128k", sampleRate: 44100 },
  compact: { bitrate: "96k", sampleRate: 44100 },
};

const audioEffectProfiles: Record<AudioEffectId, AudioEffectProfile> = {
  helium: {
    label: "Helium",
    filter: "asetrate=44100*1.38,aresample=44100,atempo=0.92",
  },
  deep: {
    label: "Basse profonde",
    filter: "asetrate=44100*0.72,aresample=44100,atempo=1.08,bass=g=8",
  },
  robot: {
    label: "Robot",
    filter: "acrusher=bits=7:mix=0.45,tremolo=f=22:d=0.55",
  },
  radio: {
    label: "Radio cassee",
    filter:
      "highpass=f=650,lowpass=f=3200,acompressor=threshold=-18dB:ratio=8:attack=5:release=80,volume=1.35",
  },
  cave: {
    label: "Cave echo",
    filter: "aecho=0.82:0.88:900|1350:0.35|0.22",
  },
  vapor: {
    label: "Vapor lent",
    filter: "asetrate=44100*0.84,aresample=44100,atempo=1.06,aecho=0.75:0.65:520:0.24",
  },
  glitch: {
    label: "Glitch tremolo",
    filter: "tremolo=f=18:d=0.78,acrusher=bits=8:mix=0.32",
  },
  telephone: {
    label: "Telephone",
    filter: "highpass=f=900,lowpass=f=3000,volume=1.45",
  },
  underwater: {
    label: "Sous l'eau",
    filter: "lowpass=f=820,aecho=0.7:0.55:85:0.24",
  },
  wide: {
    label: "Stereo large",
    filter: "aecho=0.8:0.62:360|720:0.18|0.12,treble=g=4",
  },
};

export const audioEffectIds = Object.keys(
  audioEffectProfiles,
) as AudioEffectId[];

if (typeof ffmpegStatic === "string") {
  ffmpeg.setFfmpegPath(ffmpegStatic);
}

if (ffprobeStatic.path) {
  ffmpeg.setFfprobePath(ffprobeStatic.path);
}

export async function applyAudioEffect(file: File, formData: FormData) {
  const sourceBuffer = Buffer.from(await file.arrayBuffer());
  const effect = parseAudioEffect(formData.get("effect"));

  if (!isAudioFile(file)) {
    throw new Error("Depose un fichier audio ou MP3 pour appliquer un mod.");
  }

  return transformAudioEffect({
    buffer: sourceBuffer,
    effect,
    fileName: file.name,
    originalSize: sourceBuffer.byteLength,
  });
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

  if (isAudioFile(file)) {
    const quality = parseAudioQuality(formData.get("audioQuality"));

    return compressAudio({
      buffer: sourceBuffer,
      fileName: file.name,
      originalSize,
      quality,
    });
  }

  throw new Error("Ce type de fichier n'est pas encore pris en charge.");
}

async function transformAudioEffect({
  buffer,
  effect,
  fileName,
  originalSize,
}: {
  buffer: Buffer;
  effect: AudioEffectId;
  fileName: string;
  originalSize: number;
}): Promise<CompressionResult & { effectLabel: string }> {
  const tempDirectory = await fs.mkdtemp(
    path.join(os.tmpdir(), "pulse-audio-mod-"),
  );
  const inputExtension = path.extname(fileName) || ".mp3";
  const inputPath = path.join(tempDirectory, `${randomUUID()}${inputExtension}`);
  const profile = audioEffectProfiles[effect];
  const outputName = `${stripExtension(fileName)}-${effect}.mp3`;
  const outputPath = path.join(tempDirectory, outputName);

  try {
    await fs.writeFile(inputPath, buffer);

    await new Promise<void>((resolve, reject) => {
      ffmpeg(inputPath)
        .noVideo()
        .audioFilters(profile.filter)
        .audioCodec("libmp3lame")
        .audioBitrate("160k")
        .audioFrequency(44100)
        .format("mp3")
        .on("end", () => resolve())
        .on("error", (error) => reject(error))
        .save(outputPath);
    });

    const outputBuffer = await fs.readFile(outputPath);

    return {
      buffer: outputBuffer,
      compressedSize: outputBuffer.byteLength,
      effectLabel: profile.label,
      fileName: outputName,
      mimeType: "audio/mpeg",
      originalSize,
      savedPercent: calculateSavedPercent(originalSize, outputBuffer.byteLength),
    };
  } finally {
    await fs.rm(tempDirectory, { force: true, recursive: true });
  }
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

async function compressAudio({
  buffer,
  fileName,
  originalSize,
  quality,
}: {
  buffer: Buffer;
  fileName: string;
  originalSize: number;
  quality: AudioQuality;
}): Promise<CompressionResult> {
  const tempDirectory = await fs.mkdtemp(
    path.join(os.tmpdir(), "pulse-compress-"),
  );
  const inputExtension = path.extname(fileName) || ".mp3";
  const inputPath = path.join(tempDirectory, `${randomUUID()}${inputExtension}`);
  const outputName = `${stripExtension(fileName)}-compressed.mp3`;
  const outputPath = path.join(tempDirectory, outputName);
  const profile = audioProfiles[quality];

  try {
    await fs.writeFile(inputPath, buffer);

    await new Promise<void>((resolve, reject) => {
      ffmpeg(inputPath)
        .noVideo()
        .audioCodec("libmp3lame")
        .audioBitrate(profile.bitrate)
        .audioFrequency(profile.sampleRate)
        .format("mp3")
        .on("end", () => resolve())
        .on("error", (error) => reject(error))
        .save(outputPath);
    });

    const outputBuffer = await fs.readFile(outputPath);

    return {
      buffer: outputBuffer,
      compressedSize: outputBuffer.byteLength,
      fileName: outputName,
      mimeType: "audio/mpeg",
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

function parseAudioQuality(value: FormDataEntryValue | null): AudioQuality {
  return value === "high" || value === "compact" || value === "balanced"
    ? value
    : "balanced";
}

function parseAudioEffect(value: FormDataEntryValue | null): AudioEffectId {
  return audioEffectIds.includes(value as AudioEffectId)
    ? (value as AudioEffectId)
    : audioEffectIds[Math.floor(Math.random() * audioEffectIds.length)];
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

function isAudioFile(file: File) {
  return file.type.startsWith("audio/") || file.name.toLowerCase().endsWith(".mp3");
}
