import Sidebar from '@/components/Sidebar'

export default function SidebarLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Sidebar />
      <main className="ml-[220px] min-h-screen p-8">
        {children}
      </main>
    </>
  )
}
