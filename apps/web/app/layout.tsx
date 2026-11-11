import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';
import { CommandPalette } from '../components/ui/CommandPalette';
import { HandoffInjector } from '../components/HandoffInjector';
import { AuthProvider } from '../components/auth/AuthProvider';
import { themeInitScript } from '../components/ui/ThemeToggle';
import { SITE } from '../lib/site';

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: {
    default: `${SITE.name} — ${SITE.tagline}`,
    template: `%s | ${SITE.name}`,
  },
  description: SITE.description,
  applicationName: SITE.name,
  keywords: ['PDF editor', 'merge PDF', 'compress PDF', 'PDF to Word', 'OCR PDF', 'sign PDF', 'private PDF tools'],
  openGraph: { siteName: SITE.name, type: 'website', locale: 'en_GB' },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#05070d' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="flex min-h-full flex-col bg-background font-sans text-slate-900 antialiased dark:text-slate-100">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[200] focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:shadow-lg"
        >
          Skip to content
        </a>
        <AuthProvider>
          <Navbar />
          <main id="main" className="flex-1">
            {children}
          </main>
          <Footer />
          <CommandPalette />
          <HandoffInjector />
        </AuthProvider>
      </body>
    </html>
  );
}
