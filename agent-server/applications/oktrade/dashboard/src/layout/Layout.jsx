import { Outlet } from 'react-router-dom';

function Layout() {
  return (
    <div>
      <div className="flex h-screen overflow-hidden">
        <div className="relative flex flex-1 flex-col overflow-y-auto overflow-x-hidden">
          <main className="h-screen">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  )
}

export default Layout;