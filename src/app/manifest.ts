import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "NÓS Studio",
    short_name: "NÓS",
    description: "Marketing, conteúdo e audiovisual. Sua história, nosso olhar.",
    start_url: "/",
    display: "standalone",
    background_color: "#F6F4EF",
    theme_color: "#3B1F8E",
    lang: "pt-BR",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/apple-icon.png", sizes: "180x180", type: "image/png" },
    ],
  };
}
