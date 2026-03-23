import type { Metadata } from 'next'
import { Lora } from 'next/font/google'
import './globals.css'

const lora = Lora({ subsets: ['latin'], variable: '--font-lora' })

export const metadata: Metadata = {
  title: 'Kofee - Your brew of code',
  description: 'A minimal code snippet manager',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className={`${lora.variable} antialiased`}>
        {children}
      </body>
    </html>
  )
}