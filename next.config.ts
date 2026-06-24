import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    // Typst WASM (28MB) içeriğe göre sürümlenmiş; bir kez indir, kalıcı cache'le.
    return [
      {
        source: "/typst/:file*",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
    ];
  },
};

export default nextConfig;
