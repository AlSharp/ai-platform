import { useAuth } from '@/context/auth';
import { Outlet } from 'react-router-dom';
import { AppShell } from '@mantine/core';
import Header from './Header';
import SidePanel from './SidePanel';

function ProtectedLayout() {

  const { token } = useAuth();

  return (
    <AppShell
      header={{ height: 72 }}
      navbar={{
        width: 250
      }}
    >
      <AppShell.Header>
        <Header />
      </AppShell.Header>
      <AppShell.Navbar className="flex flex-col justify-between" p="md">
        <SidePanel />
      </AppShell.Navbar>
      <AppShell.Main>
        <Outlet />
      </AppShell.Main>
    </AppShell>
  )
}

export default ProtectedLayout;