import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["zod"],
  // Banner uploads are up to 10 MB; multipart wrapping needs a little extra headroom.
  experimental: {
    serverActions: {
      bodySizeLimit: "12mb",
    },
  },
};

export default nextConfig;
