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
            {
                // Supabase Storage — hosts project logos and other branding
                // assets. Covers any *.supabase.co project (the hostname in
                // NEXT_PUBLIC_SUPABASE_URL) so next/image can load them.
                protocol: "https",
                hostname: "*.supabase.co",
                port: "",
                pathname: "/**",
            },
        ],
        dangerouslyAllowLocalIP: true, // Allow images from localhost/private IPs (development only)
    },
    devIndicators: false,
};

export default nextConfig;
