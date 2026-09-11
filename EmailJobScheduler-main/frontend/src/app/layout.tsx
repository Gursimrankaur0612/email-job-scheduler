import type { Metadata } from "next";
import { SessionProviderWrapper } from "@/components/providers/SessionProviderWrapper";
import "./globals.css";

export const metadata: Metadata = {
  title: "Email Job Scheduler",
  description: "Schedule and send emails on a queue-backed worker.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <SessionProviderWrapper>{children}</SessionProviderWrapper>
      </body>
    </html>
  );
}
