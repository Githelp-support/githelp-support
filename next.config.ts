import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    images: {
        remotePatterns: [
            {
                protocol: "https",
                hostname: "avatars.githubusercontent.com",
                port: "",
                pathname: "/**",
            },
            {
                protocol: "https",
                hostname: "images.unsplash.com",
                port: "",
                pathname: "/**",
            },
            {
                protocol: "http",
                hostname: "localhost",
                port: "54321",
                pathname: "/**",
            },
        ],
        dangerouslyAllowLocalIP: true, // Allow images from localhost/private IPs (development only)
    },
    devIndicators: false,
};

export default nextConfig;
