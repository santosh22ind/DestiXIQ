import type { Metadata } from "next";
import { Space_Grotesk } from "next/font/google";
import "./globals.css";
import { createAuthClient } from "@/lib/supabase/server-client";
import { TopNav } from "@/components/TopNav";
import { Footer } from "@/components/Footer";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "DestiXIQ",
  description: "Destination-specific travel briefings.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const supabase = await createAuthClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <html lang="en" className={`${spaceGrotesk.variable} h-full antialiased`}>
      <body className="min-h-full bg-cream p-3 sm:p-6">
        <div className="mx-auto flex min-h-[calc(100vh-1.5rem)] max-w-6xl flex-col rounded-[2rem] border-2 border-ink bg-cream sm:min-h-[calc(100vh-3rem)]">
          <TopNav userEmail={user?.email} />
          <main className="flex flex-1 flex-col">{children}</main>
          <Footer />
        </div>
      </body>
    </html>
  );
}
