import type { NextConfig } from "next";

// Dev-only colour scheme tester (src/components/dev). On for `next dev` and for
// Netlify deploy previews / branch deploys, off for production and for any
// environment we do not recognise. Netlify sets NETLIFY and CONTEXT during builds.
const showColourTester =
    process.env.NODE_ENV === "development" ||
    (process.env.NETLIFY === "true" && !!process.env.CONTEXT && process.env.CONTEXT !== "production");

const nextConfig: NextConfig = {
    env: {
        NEXT_PUBLIC_COLOUR_TESTER: showColourTester ? "true" : "false",
    },
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
            // Local Supabase stack — development only.
            ...(process.env.NODE_ENV === "development"
                ? [{ protocol: "http" as const, hostname: "localhost", port: "54321", pathname: "/**" }]
                : []),
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
        // Private-IP image hosts are only needed against a local Supabase stack.
        dangerouslyAllowLocalIP: process.env.NODE_ENV === "development",
    },
    devIndicators: false,
    // Nothing embeds the app: refuse framing (clickjacking on the guest-link
    // dialog, Checkout and claim buttons) and MIME sniffing everywhere.
    async headers() {
        return [
            {
                source: "/:path*",
                headers: [
                    { key: "X-Frame-Options", value: "DENY" },
                    { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
                    { key: "X-Content-Type-Options", value: "nosniff" },
                    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
                ],
            },
        ];
    },
};

export default nextConfig;
