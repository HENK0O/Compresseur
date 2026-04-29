"use client";

import { startTransition, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDownToLine,
  ArrowRight,
  Check,
  ImageIcon,
  Music,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  UploadCloud,
  Video,
  WandSparkles,
  Zap,
} from "lucide-react";
import { CustomCursor } from "@/components/custom-cursor";
import {
  formatBytes,
  formatPercent,
  inferKind,
  makeDownloadName,
} from "@/lib/format";

type MediaKind = "image" | "video" | "audio" | "unknown";
type ImageFormat = "preserve" | "webp" | "jpeg" | "png" | "avif";
type VideoQuality = "light" | "balanced" | "strong";
type VideoHeight = "source" | "1080" | "720" | "480";
type AudioQuality = "high" | "balanced" | "compact";

type CompressionResult = {
  compressedSize: number;
  downloadName: string;
  originalSize: number;
  savedPercent: number;
  url: string;
};

const imageFormats: { label: string; value: ImageFormat }[] = [
  { label: "Conserver", value: "preserve" },
  { label: "WebP", value: "webp" },
  { label: "JPEG", value: "jpeg" },
  { label: "PNG", value: "png" },
  { label: "AVIF", value: "avif" },
];

const videoProfiles: { label: string; value: VideoQuality; note: string }[] = [
  { label: "Light", value: "light", note: "qualite elevee" },
  { label: "Balanced", value: "balanced", note: "equilibre propre" },
  { label: "Strong", value: "strong", note: "plus compact" },
];

const videoHeights: { label: string; value: VideoHeight }[] = [
  { label: "Source", value: "source" },
  { label: "1080p", value: "1080" },
  { label: "720p", value: "720" },
  { label: "480p", value: "480" },
];

const audioProfiles: { label: string; value: AudioQuality; note: string }[] = [
  { label: "High", value: "high", note: "192 kb/s" },
  { label: "Balanced", value: "balanced", note: "128 kb/s" },
  { label: "Compact", value: "compact", note: "96 kb/s" },
];

const highlights = [
  {
    icon: Zap,
    title: "Compression locale",
    text: "Ton media reste sur ta machine. Aucun service externe, aucun credit a racheter.",
  },
  {
    icon: ShieldCheck,
    title: "Pour images et videos",
    text: "Sharp gere les images, FFmpeg s'occupe des videos. Un seul workflow pour tout ton contenu.",
  },
  {
    icon: WandSparkles,
    title: "Interface premium",
    text: "Curseur sur mesure, survols lumineux, panneaux en verre et feeling beaucoup plus haut de gamme.",
  },
];

export function CompressStudio() {
  const [dragActive, setDragActive] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [audioQuality, setAudioQuality] = useState<AudioQuality>("balanced");
  const [imageFormat, setImageFormat] = useState<ImageFormat>("webp");
  const [imageQuality, setImageQuality] = useState(72);
  const [isCompressing, setIsCompressing] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [result, setResult] = useState<CompressionResult | null>(null);
  const [videoHeight, setVideoHeight] = useState<VideoHeight>("720");
  const [videoQuality, setVideoQuality] = useState<VideoQuality>("light");
  const inputRef = useRef<HTMLInputElement | null>(null);

  const kind = useMemo<MediaKind>(() => inferKind(file), [file]);

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);

    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [file]);

  useEffect(() => {
    return () => {
      if (result?.url) {
        URL.revokeObjectURL(result.url);
      }
    };
  }, [result]);

  const savedBytes =
    result !== null ? result.originalSize - result.compressedSize : 0;

  function resetOutputState() {
    setErrorMessage(null);
    if (result?.url) {
      URL.revokeObjectURL(result.url);
    }
    setResult(null);
  }

  function onFileChosen(nextFile: File | null) {
    if (!nextFile) {
      return;
    }

    resetOutputState();
    setFile(nextFile);

    if (inferKind(nextFile) === "image") {
      setImageFormat("webp");
    }
  }

  function openPicker() {
    inputRef.current?.click();
  }

  function handleDragState(active: boolean) {
    setDragActive(active);
  }

  async function handleCompress() {
    if (!file) {
      setErrorMessage("Ajoute un fichier avant de lancer la compression.");
      return;
    }

    setIsCompressing(true);
    setErrorMessage(null);

    const formData = new FormData();
    formData.set("file", file);
    formData.set("imageQuality", String(imageQuality));
    formData.set("imageFormat", imageFormat);
    formData.set("videoQuality", videoQuality);
    formData.set("videoHeight", videoHeight);
    formData.set("audioQuality", audioQuality);

    try {
      const response = await fetch("/api/compress", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;

        throw new Error(
          payload?.error ?? "La compression a echoue pour ce fichier.",
        );
      }

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const originalSize = Number(response.headers.get("X-Original-Size") ?? 0);
      const compressedSize = Number(
        response.headers.get("X-Compressed-Size") ?? blob.size,
      );
      const savedPercent = Number(
        response.headers.get("X-Saved-Percent") ?? 0,
      );
      const downloadName = makeDownloadName(file.name, blob.type);

      startTransition(() => {
        setResult({
          compressedSize,
          downloadName,
          originalSize,
          savedPercent,
          url: objectUrl,
        });
      });
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Une erreur inattendue est survenue.",
      );
    } finally {
      setIsCompressing(false);
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden px-5 py-6 text-white sm:px-8 lg:px-10">
      <CustomCursor />
      <div className="mesh-orb left-[-7rem] top-[8rem] h-52 w-52 bg-cyan-300/30" />
      <div className="mesh-orb right-[-5rem] top-[-2rem] h-56 w-56 bg-amber-300/30" />
      <div className="mesh-orb bottom-[10%] right-[18%] h-48 w-48 bg-sky-400/20" />

      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8">
        <section className="glass-panel gradient-stroke relative overflow-hidden rounded-[2rem] px-6 py-8 sm:px-8 lg:px-10">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-200/70 to-transparent" />
          <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
            <div className="space-y-6">
              <span
                data-cursor="Pulse"
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/6 px-4 py-2 text-xs uppercase tracking-[0.28em] text-cyan-100/90"
              >
                <Sparkles className="h-4 w-4 text-cyan-300" />
                PulseCompress
              </span>

              <div className="space-y-4">
                <h1 className="max-w-3xl text-5xl font-semibold leading-[0.95] text-glow sm:text-6xl lg:text-7xl">
                  Ton propre compresseur d&apos;images, videos et MP3, sans
                  abonnements inutiles.
                </h1>
                <p className="max-w-2xl text-base leading-8 text-slate-300 sm:text-lg">
                  Une app Next.js locale, pensee pour compresser vite, garder la
                  main sur tes fichiers et offrir une experience plus elegante
                  qu&apos;un simple outil d&apos;upload.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <StatCard label="Formats" value="Images + videos + MP3" />
                <StatCard label="Traitement" value="Local-first" />
                <StatCard label="Style" value="Cursor premium" />
              </div>
            </div>

            <div className="grid gap-4 text-sm text-slate-200">
              {highlights.map(({ icon: Icon, title, text }) => (
                <article
                  key={title}
                  className="glass-panel soft-hover rounded-[1.5rem] px-5 py-5"
                >
                  <div className="flex items-start gap-4">
                    <div className="rounded-2xl border border-cyan-200/15 bg-cyan-300/10 p-3 text-cyan-200">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="space-y-1">
                      <h2 className="text-base font-semibold text-white">
                        {title}
                      </h2>
                      <p className="leading-7 text-slate-300">{text}</p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="glass-panel gradient-stroke rounded-[2rem] p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-sm uppercase tracking-[0.22em] text-cyan-200/70">
                  Studio
                </p>
                <h2 className="mt-2 text-2xl font-semibold text-white">
                  Depose ton fichier et regle la compression
                </h2>
              </div>

              <button
                type="button"
                onClick={openPicker}
                data-cursor="Upload"
                className="ring-button shine soft-hover inline-flex items-center gap-2 rounded-full border border-cyan-200/15 px-4 py-2.5 text-sm font-medium text-cyan-50"
              >
                <UploadCloud className="h-4 w-4" />
                Choisir un fichier
              </button>
            </div>

            <input
              ref={inputRef}
              type="file"
              className="hidden"
              accept="image/*,video/*,audio/mpeg,.mp3"
              onChange={(event) =>
                onFileChosen(event.target.files?.item(0) ?? null)
              }
            />

            <div
              role="button"
              tabIndex={0}
              data-cursor="Drop"
              onClick={openPicker}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  openPicker();
                }
              }}
              onDragEnter={(event) => {
                event.preventDefault();
                handleDragState(true);
              }}
              onDragOver={(event) => {
                event.preventDefault();
                handleDragState(true);
              }}
              onDragLeave={(event) => {
                event.preventDefault();
                handleDragState(false);
              }}
              onDrop={(event) => {
                event.preventDefault();
                handleDragState(false);
                onFileChosen(event.dataTransfer.files?.item(0) ?? null);
              }}
              className={`dashed-zone mt-6 rounded-[1.75rem] px-5 py-8 outline-none transition duration-300 ${
                dragActive
                  ? "scale-[1.01] border-cyan-300/70 shadow-[0_0_0_1px_rgba(103,232,249,0.18)]"
                  : "border-white/15"
              }`}
            >
              <div className="flex flex-col items-center gap-4 text-center">
                <div className="rounded-[1.7rem] border border-white/10 bg-white/6 p-4 text-cyan-200">
                  {kind === "video" ? (
                    <Video className="h-8 w-8" />
                  ) : kind === "audio" ? (
                    <Music className="h-8 w-8" />
                  ) : (
                    <ImageIcon className="h-8 w-8" />
                  )}
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-semibold text-white">
                    {file
                      ? `Pret a compresser: ${file.name}`
                      : "Glisse une image, une video ou un MP3 ici"}
                  </h3>
                  <p className="mx-auto max-w-xl text-sm leading-7 text-slate-300">
                    Support natif des images, videos et fichiers MP3.
                    Le traitement est pense pour un usage local sur ton poste.
                  </p>
                </div>

                {file ? (
                  <div className="flex flex-wrap items-center justify-center gap-3 text-xs uppercase tracking-[0.18em] text-slate-300">
                    <span className="rounded-full border border-white/10 bg-white/6 px-3 py-2">
                      {kind}
                    </span>
                    <span className="rounded-full border border-white/10 bg-white/6 px-3 py-2">
                      {formatBytes(file.size)}
                    </span>
                    <span className="rounded-full border border-white/10 bg-white/6 px-3 py-2">
                      {file.type || "type inconnu"}
                    </span>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="mt-6 grid gap-5">
              {kind === "image" ? (
                <div className="grid gap-5 rounded-[1.5rem] border border-white/10 bg-white/5 p-5">
                  <div className="flex items-center gap-3">
                    <SlidersHorizontal className="h-4 w-4 text-cyan-200" />
                    <p className="text-sm font-medium text-slate-100">
                      Reglages image
                    </p>
                  </div>

                  <label className="space-y-3 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-300">Qualite</span>
                      <span className="font-mono text-cyan-100">
                        {imageQuality}
                      </span>
                    </div>
                    <input
                      className="range-input"
                      type="range"
                      min={35}
                      max={90}
                      value={imageQuality}
                      onChange={(event) =>
                        setImageQuality(Number(event.target.value))
                      }
                    />
                  </label>

                  <div className="grid gap-3 sm:grid-cols-5">
                    {imageFormats.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        data-cursor={option.label}
                        onClick={() => setImageFormat(option.value)}
                        className={`soft-hover rounded-2xl border px-3 py-3 text-sm ${
                          imageFormat === option.value
                            ? "border-cyan-300/70 bg-cyan-300/15 text-white"
                            : "border-white/10 bg-white/4 text-slate-300"
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              {kind === "video" ? (
                <div className="grid gap-5 rounded-[1.5rem] border border-white/10 bg-white/5 p-5">
                  <div className="flex items-center gap-3">
                    <SlidersHorizontal className="h-4 w-4 text-cyan-200" />
                    <p className="text-sm font-medium text-slate-100">
                      Reglages video
                    </p>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3">
                    {videoProfiles.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        data-cursor={option.label}
                        onClick={() => setVideoQuality(option.value)}
                        className={`soft-hover rounded-[1.25rem] border px-4 py-4 text-left ${
                          videoQuality === option.value
                            ? "border-cyan-300/70 bg-cyan-300/15 text-white"
                            : "border-white/10 bg-white/4 text-slate-300"
                        }`}
                      >
                        <p className="font-medium">{option.label}</p>
                        <p className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-400">
                          {option.note}
                        </p>
                      </button>
                    ))}
                  </div>

                  <div className="grid gap-3 sm:grid-cols-4">
                    {videoHeights.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        data-cursor={option.label}
                        onClick={() => setVideoHeight(option.value)}
                        className={`soft-hover rounded-2xl border px-3 py-3 text-sm ${
                          videoHeight === option.value
                            ? "border-amber-300/70 bg-amber-300/14 text-white"
                            : "border-white/10 bg-white/4 text-slate-300"
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              {kind === "audio" ? (
                <div className="grid gap-5 rounded-[1.5rem] border border-white/10 bg-white/5 p-5">
                  <div className="flex items-center gap-3">
                    <SlidersHorizontal className="h-4 w-4 text-cyan-200" />
                    <p className="text-sm font-medium text-slate-100">
                      Reglages MP3
                    </p>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3">
                    {audioProfiles.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        data-cursor={option.label}
                        onClick={() => setAudioQuality(option.value)}
                        className={`soft-hover rounded-[1.25rem] border px-4 py-4 text-left ${
                          audioQuality === option.value
                            ? "border-cyan-300/70 bg-cyan-300/15 text-white"
                            : "border-white/10 bg-white/4 text-slate-300"
                        }`}
                      >
                        <p className="font-medium">{option.label}</p>
                        <p className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-400">
                          {option.note}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              {errorMessage ? (
                <p className="rounded-2xl border border-rose-300/30 bg-rose-300/10 px-4 py-3 text-sm text-rose-100">
                  {errorMessage}
                </p>
              ) : null}

              <button
                type="button"
                data-cursor={isCompressing ? "..." : "Go"}
                disabled={!file || isCompressing}
                onClick={handleCompress}
                className="shine soft-hover flex items-center justify-center gap-3 rounded-[1.4rem] border border-cyan-200/20 bg-gradient-to-r from-cyan-300/24 via-sky-300/18 to-amber-300/18 px-5 py-4 text-base font-medium text-white disabled:cursor-not-allowed disabled:opacity-45"
              >
                {isCompressing ? "Compression en cours..." : "Compresser maintenant"}
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="grid gap-6">
            <div className="glass-panel gradient-stroke rounded-[2rem] p-5 sm:p-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm uppercase tracking-[0.22em] text-cyan-200/70">
                    Apercu
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold text-white">
                    Visualise ton media
                  </h2>
                </div>
                {file ? (
                  <span className="rounded-full border border-white/10 bg-white/6 px-3 py-2 text-xs uppercase tracking-[0.18em] text-slate-300">
                    {formatBytes(file.size)}
                  </span>
                ) : null}
              </div>

              <div className="mt-5 rounded-[1.75rem] border border-white/10 bg-slate-950/40 p-3">
                {previewUrl ? (
                  kind === "video" ? (
                    <video
                      key={previewUrl}
                      controls
                      className="aspect-video w-full rounded-[1.25rem] object-cover"
                      src={previewUrl}
                    />
                  ) : kind === "audio" ? (
                    <div className="flex min-h-[20rem] items-center justify-center rounded-[1.25rem] border border-white/10 bg-white/[0.03] px-4">
                      <audio key={previewUrl} controls className="w-full" src={previewUrl} />
                    </div>
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={previewUrl}
                      alt="Apercu du media selectionne"
                      className="max-h-[26rem] w-full rounded-[1.25rem] object-cover"
                    />
                  )
                ) : (
                  <div className="flex min-h-[20rem] items-center justify-center rounded-[1.25rem] border border-dashed border-white/10 bg-white/[0.03] text-center text-sm leading-7 text-slate-400">
                    Choisis un media pour voir son apercu, puis ajuste les
                    reglages avant telechargement.
                  </div>
                )}
              </div>
            </div>

            <div className="glass-panel gradient-stroke rounded-[2rem] p-5 sm:p-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm uppercase tracking-[0.22em] text-amber-200/70">
                    Resultat
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold text-white">
                    Gain de poids
                  </h2>
                </div>
                {result ? (
                  <div className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-2 text-xs uppercase tracking-[0.18em] text-emerald-100">
                    {formatPercent(result.savedPercent)} de reduction
                  </div>
                ) : null}
              </div>

              {result ? (
                <div className="mt-5 space-y-5">
                  <div className="grid gap-3 sm:grid-cols-3">
                    <MetricCard label="Avant" value={formatBytes(result.originalSize)} />
                    <MetricCard label="Apres" value={formatBytes(result.compressedSize)} />
                    <MetricCard label="Economise" value={formatBytes(savedBytes)} />
                  </div>

                  <div className="rounded-[1.5rem] border border-emerald-300/20 bg-emerald-300/8 px-4 py-4 text-sm leading-7 text-emerald-50">
                    <div className="flex items-center gap-2 font-medium">
                      <Check className="h-4 w-4" />
                      Compression terminee
                    </div>
                    <p className="mt-2 text-emerald-50/85">
                      Le fichier est pret. Tu peux le recuperer immediatement
                      sans quitter le site.
                    </p>
                  </div>

                  <a
                    href={result.url}
                    download={result.downloadName}
                    data-cursor="Save"
                    className="shine soft-hover inline-flex w-full items-center justify-center gap-3 rounded-[1.4rem] border border-white/10 bg-white/8 px-5 py-4 text-base font-medium text-white"
                  >
                    <ArrowDownToLine className="h-4 w-4" />
                    Telecharger le fichier compresse
                  </a>
                </div>
              ) : (
                <div className="mt-5 rounded-[1.5rem] border border-dashed border-white/10 bg-white/[0.03] px-4 py-10 text-sm leading-7 text-slate-400">
                  Lance une compression pour voir le poids gagne, le pourcentage
                  economise et un telechargement direct.
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1.35rem] border border-white/10 bg-white/[0.05] px-4 py-4">
      <p className="text-xs uppercase tracking-[0.22em] text-slate-400">
        {label}
      </p>
      <p className="mt-2 text-lg font-semibold text-white">{value}</p>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1.35rem] border border-white/10 bg-white/[0.05] px-4 py-4">
      <p className="text-xs uppercase tracking-[0.22em] text-slate-400">
        {label}
      </p>
      <p className="mt-2 font-mono text-xl font-medium text-white">{value}</p>
    </div>
  );
}
