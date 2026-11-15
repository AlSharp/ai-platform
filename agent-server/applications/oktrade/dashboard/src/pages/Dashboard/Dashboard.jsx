import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAppState } from "@/context/appState";
import { useAuthFetch } from "@/lib/fetch";
import { notifications } from '@mantine/notifications';
import { getEnv, buildNotificationError } from "@/lib/utils";

function Dashboard() {
  const _fetch = useAuthFetch();

  const [appState, setAppState] = useAppState();

  return (
    <div className="page m-4">
      Dashboard
    </div>
  )
}

export default Dashboard;