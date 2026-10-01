import type { Metadata, Viewport } from "next";
import { CleanTransientQuery } from "@/components/navigation/clean-transient-query";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "eMarketSelect EMS",
    template: "%s | eMarketSelect EMS",
  },
  description: "Internal employee management system for eMarketSelect.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#181818",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <CleanTransientQuery />
        {children}
      </body>
    </html>
  );
}
