import type { Metadata } from 'next';
import { VT323 } from 'next/font/google';
import './globals.css';

const terminalFont = VT323({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-terminal',
});

export const metadata: Metadata = {
  title: 'Weather Reliability Lab',
  description: 'Track how forecast accuracy evolves between J+1 and J+5 for a target zone.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr">
      <body className={terminalFont.variable}>{children}</body>
    </html>
  );
}
