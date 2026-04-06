import type { Metadata } from 'next'
import './globals.css'
import ErrorBoundary from '@/components/ErrorBoundary'
import { Analytics } from "@vercel/analytics/next"
import { JetBrains_Mono, Lora } from 'next/font/google'

const lora = Lora({ subsets: ['latin'], variable: '--font-lora' })
const jetBrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['300', '400', '500'],
  variable: '--font-jetbrains',
})

export const metadata: Metadata = {
  title: 'Kofee - Your brew of code',
  description: 'A minimal code snippet manager',
  icons: "https://kofee.dev/favicon.ico",

  openGraph: {
    title: 'Kofee - Your brew of code',
    description: 'A minimal code snippet manager',
    url: 'https://kofee.dev',
    siteName: 'Kofee',
    images: [
      {
        url: 'https://kofee.dev/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Kofee preview',
      },
    ],
    type: 'website',
  },

  twitter: {
    card: 'summary_large_image',
    title: 'Kofee - Your brew of code',
    description: 'A minimal code snippet manager',
    images: ['https://kofee.dev/og-image.png'],
  },
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={`${lora.variable} ${jetBrainsMono.variable} antialiased`}>
        <ErrorBoundary>
          {children}
          <Analytics />
        </ErrorBoundary>
      </body>
    </html>
  )
}