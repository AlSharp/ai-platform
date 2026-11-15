import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAppState } from "@/context/appState";
import { useAuthFetch } from "@/lib/fetch";

import { useUIConfigSelector } from "@/context/uiConfig";

function Reports() {
  const _fetch = useAuthFetch();

  const [appState, setAppState] = useAppState();

  useEffect(() => {
    
  }, []);

  return (
    <div className="page m-4">
      Reports
    </div>
  )
}

export default Reports;