import type { Metadata } from 'next';
import { IBM_Plex_Sans, IBM_Plex_Mono } from 'next/font/google';
import { ThemeProvider, CssBaseline } from '@mui/material';
import EmotionRegistry from './EmotionRegistry';
import { theme } from '@/theme';
import { AuthProvider } from '@/lib/auth-context';
import { ToastProvider } from '@/components/providers/ToastProvider';
import { ConfirmProvider } from '@/components/providers/ConfirmProvider';

const ibmPlexSans = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-ibm-plex-sans',
  display: 'swap',
});

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-ibm-plex-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Notarify Digital Passport Platform',
  description: 'Notarify Digital Passport Platform — back office',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${ibmPlexSans.variable} ${ibmPlexMono.variable}`}>
      <body className={ibmPlexSans.className}>
        <EmotionRegistry>
          <ThemeProvider theme={theme}>
            <CssBaseline />
            <ToastProvider>
              <ConfirmProvider>
                <AuthProvider>{children}</AuthProvider>
              </ConfirmProvider>
            </ToastProvider>
          </ThemeProvider>
        </EmotionRegistry>
      </body>
    </html>
  );
}
