import { createBrowserRouter, Navigate, Outlet, useLocation } from "react-router-dom";
import { Layout } from "./components/Layout";
import { WeightPage } from "./pages/WeightPage";
import { DailyPage } from "./pages/DailyPage";
import { TrendPage } from "./pages/TrendPage";
import { LandingPage } from "./pages/LandingPage";
import { AboutPage } from "./pages/AboutPage";
import { useAuthenticated } from "./lib/useAuthenticated";

function HomeRoute() {
  const isAuthenticated = useAuthenticated();
  if (isAuthenticated) {
    return <Navigate to="/daily" replace />;
  }
  return <LandingPage />;
}

// Gate that redirects any unauthenticated access to landing, remembering intended path
function AuthedOutlet() {
  const isAuthenticated = useAuthenticated();
  const location = useLocation();
  if (!isAuthenticated) {
    const redirect = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/?redirect=${redirect}`} replace />;
  }
  return <Outlet />;
}

export const router = createBrowserRouter([
  {
    path: "/",
    element: <Layout />,
    children: [
      // Public routes
      { index: true, element: <HomeRoute /> },
      { path: "about", element: <AboutPage /> },

      // Authenticated routes (all gated)
      {
        element: <AuthedOutlet />,
        children: [
          { path: "weight", element: <WeightPage /> },
          { path: "daily", element: <DailyPage /> },
          { path: "trends", element: <TrendPage /> },
        ],
      },
    ],
  },
]);
