import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "ffmpeg-static",
    "ffprobe-static",
    "fluent-ffmpeg",
    "sharp",
  ],
};

export default nextConfig;
