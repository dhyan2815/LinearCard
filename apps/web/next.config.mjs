import path from "path";

/** @type {import('next').NextConfig} */
const nextConfig = {

  turbopack: {
    root: path.resolve(import.meta.dirname, "../../"),
  },
};

export default nextConfig;  
