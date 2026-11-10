import type { Metadata } from 'next'
import localFont from 'next/font/local'
import './globals.css'

// The app's bundled weights (res/font), OFL.
const jetbrainsMono = localFont({
  variable: '--font-jb',
  src: [
    { path: './fonts/jetbrains_mono_regular.ttf', weight: '400' },
    { path: './fonts/jetbrains_mono_semibold.ttf', weight: '600' },
    { path: './fonts/jetbrains_mono_bold.ttf', weight: '700' },
    { path: './fonts/jetbrains_mono_extrabold.ttf', weight: '800' },
  ],
})

export const metadata: Metadata = {
  title: 'INSIGHT: a calm tile-swapping puzzle',
  description: 'A little order. A little wonder. A tile-swapping puzzle for Android where every tile moves only the way its arrows point. The Journey campaign is free.',
}

// Before first paint: the saved choice, otherwise the system theme. Dark is the default without JavaScript.
const theme = `try{document.documentElement.dataset.theme=localStorage.theme||(matchMedia('(prefers-color-scheme: light)').matches?'light':'dark')}catch(e){}`

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" className={`${jetbrainsMono.variable} antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: theme }} />
      </head>
      <body>{children}</body>
    </html>
  )
}
