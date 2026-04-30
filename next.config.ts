import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      { source: "/history", destination: "/?tab=history", permanent: false },
      { source: "/schedule", destination: "/?tab=schedule", permanent: false },
      { source: "/research", destination: "/job-analysis?tab=research", permanent: false },
      { source: "/decode", destination: "/job-analysis?tab=decode", permanent: false },
      { source: "/linkedin", destination: "/communication?tab=profile", permanent: false },
      { source: "/networking", destination: "/communication?tab=scripts", permanent: false },
      { source: "/evaluate", destination: "/mock?tab=evaluate", permanent: false },
      { source: "/hype", destination: "/mock?tab=hype", permanent: false },
      { source: "/thankyou", destination: "/debrief", permanent: false },
    ];
  },
};

export default nextConfig;
