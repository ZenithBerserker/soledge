import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Meteora DLMM opportunities',
  description: 'Live feed from the scanner worker (dashboard on Vercel).',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
