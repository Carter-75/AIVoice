import "./globals.css";
import "bulma/css/bulma.min.css";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AIVoice",
  description: "A polished voice interface for PersonaPlex.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  );
}


