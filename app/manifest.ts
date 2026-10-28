import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "UNITHE 법카노트",
    short_name: "법카노트",
    description: "한 줄로 기록하는 유니더수학 법인카드 사용내역",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#176B45",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
