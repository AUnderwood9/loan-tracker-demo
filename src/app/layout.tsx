import type { Metadata } from "next";
import Link from "next/link";
import { ELEMENT_IDS } from "@/lib/ui/element-ids";
import { ROUTES } from "@/lib/ui/routes";
import { UI_TEXT } from "@/lib/ui/ui-text";
import "./globals.css";

export const metadata: Metadata = {
  title: UI_TEXT.appTitle,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>
        <header id={ELEMENT_IDS.appHeader} className="app-header">
          <Link id={ELEMENT_IDS.homeLink} href={ROUTES.applications} className="app-title">
            {UI_TEXT.appTitle}
          </Link>
        </header>
        <main id={ELEMENT_IDS.mainContent} className="app-main">
          {children}
        </main>
      </body>
    </html>
  );
}
