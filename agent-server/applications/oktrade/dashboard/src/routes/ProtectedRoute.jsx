import { useEffect } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/context/auth";
import { useAuthFetch } from "@/lib/fetch";
import { useAppState } from "@/context/appState";
import { notifications } from '@mantine/notifications';
import { buildNotificationError } from "@/lib/utils";

export const ProtectedRoute = () => {
  const { token } = useAuth();

  const _fetch = useAuthFetch();

  const [_, setAppState] = useAppState();

  useEffect(() => {
    if (token) {
      getSystemState();
    }
  }, [])

  const getSystemState = async () => {
    try {
      const { data: state } = await _fetch.get('/core/state/get');
      setAppState(state);
    }
    catch(error) {
      notifications.show(buildNotificationError(error, 'api'));
    }
  }

  if (!token) {
    return <Navigate to="/login" />;
  }

  return <Outlet />;
};