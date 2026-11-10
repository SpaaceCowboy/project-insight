import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export", // plain static files in out/, served by nginx
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
