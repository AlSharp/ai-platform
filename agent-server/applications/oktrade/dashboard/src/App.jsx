import { createTheme, MantineProvider } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import { ModalsProvider } from '@mantine/modals';
import { AuthProvider } from "@/context/auth";
import { AppStateProvider } from "@/context/appState";
import { SocketProvider } from '@/context/socket';
import { UIConfigProvider } from "./context/uiConfig";
import Routes from "./routes";
import Spinner from '@/layout/Spinner';
import '@mantine/notifications/styles.css';

const theme = createTheme({});

function App() {
  return (
    <MantineProvider theme={theme}>
      <ModalsProvider>
        <UIConfigProvider>
          <AppStateProvider>
            <AuthProvider>
              <SocketProvider>
                <Spinner />
                <Notifications position='top-right' zIndex={1001} limit={5} autoClose={5000} />
                <Routes />
              </SocketProvider>
            </AuthProvider>
          </AppStateProvider>
        </UIConfigProvider>
      </ModalsProvider>
    </MantineProvider>
  )
}

export default App
