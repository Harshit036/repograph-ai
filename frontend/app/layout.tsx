import type { Metadata } from 'next'
import './globals.css'
import Sidebar from '@/components/Sidebar'

export const metadata: Metadata = {
  title: 'RepoGraph AI',
  description: 'Repository Intelligence Platform',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="bg-bg text-white">
        <Sidebar />
        <main className="ml-[220px] min-h-screen p-8">
          {children}
        </main>
      </body>
    </html>
  )
}
