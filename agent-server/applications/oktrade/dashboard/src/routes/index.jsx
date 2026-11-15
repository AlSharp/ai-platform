import { RouterProvider, createBrowserRouter } from "react-router-dom";
import { useAuth } from "@/context/auth";
import Layout from "@/layout/Layout";
import { ProtectedRoute } from "./ProtectedRoute";
import ProtectedLayout from '@/layout/ProtectedLayout';

import Login from "@/pages/Login/Login";
import ForgotPassword from '@/pages/ForgotPassword/ForgotPassword';
import TDCallback from "@/pages/TDCallback";

import Dashboard from '@/pages/Dashboard/Dashboard';

import Accounts from "@/pages/Accounts/Accounts";
import Account from "@/pages/Accounts/Account";
import EditAccount from "@/pages/Accounts/EditAccount";
import AccountStrategies from '@/pages/Accounts/AccountStrategies';

import Strategies from '@/pages/Strategies/Strategies';
import AddStrategy from "@/pages/Strategies/AddStrategy";
import Strategy from '@/pages/Strategies/Strategy';
import EditStrategy from '@/pages/Strategies/EditStrategy';

import Journals from '@/pages/Journals/Journals';
import Journal from '@/pages/Journals/Journal';

import Reports from '@/pages/Reports/Reports';
import Report from '@/pages/Reports/Report';

import Settings from "@/pages/Settings/Settings";
import AddLiveTradingClient from '@/pages/Settings/AddLiveTradingClient';

const Routes = () => {
  const { token } = useAuth();

  const publicRoutes = [];

  const protectedRoutes = [
    {
      path: "/",
      element: <ProtectedLayout />,
      children: [
        {
          path: "",
          element: <ProtectedRoute />,
          children: [
            {
              path: "",
              element: <Dashboard />,
            },
            {
              path: "/accounts",
              element: <Accounts />,
            },
            {
              path: "/accounts/:id",
              element: <Account />,
            },
            {
              path: "/accounts/:id/edit",
              element: <EditAccount />,
            },
            {
              path: "/accounts/:id/strategies",
              element: <AccountStrategies />,
            },
            {
              path: "/strategies",
              element: <Strategies />,
            },
            {
              path: "/strategies/add",
              element: <AddStrategy />,
            },
            {
              path: "/strategies/:id",
              element: <Strategy />,
            },
            {
              path: "/strategies/:id/edit",
              element: <EditStrategy />,
            },
            {
              path: "/strategies/:id/journal",
              element: <Journal />,
            },
            {
              path: "/journals",
              element: <Journals />,
            },
            {
              path: "/journals/:id",
              element: <Journal />,
            },
            {
              path: "/reports",
              element: <Reports />,
            },
            {
              path: "/reports/:id",
              element: <Report />,
            },
            {
              path: "/settings",
              element: <Settings />,
            },
            {
              path: "/settings/add-live-trading-client",
              element: <AddLiveTradingClient />,
            },
          ],
        },
        {
          path: "/td-callback",
          element: <TDCallback />,
        },
      ]
    },
  ];

  const unprotectedRoutes = [
    {
      path: "/",
      element: <Layout />,
      children: [
        {
          path: "",
          element: <Login />,
        },
        {
          path: "/login",
          element: <Login />,
        },
        {
          path: "/forgot-password",
          element: <ForgotPassword />,
        },
      ]
    }
  ];

  const protectedWithoutLayout = [
    
  ]

  const router = createBrowserRouter([
    ...publicRoutes,
    ...(!token ? unprotectedRoutes : []),
    ...protectedRoutes,
    ...protectedWithoutLayout
  ], {
    basename: '/dashboard'
  });

  return <RouterProvider router={router} />;
};

export default Routes;