import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "NexRedirect",
  description: "Self-hosted Domain-Redirect-Server mit Analytics",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de" className="dark">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
