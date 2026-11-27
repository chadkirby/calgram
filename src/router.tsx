import { createBrowserRouter, Navigate, Outlet, useLocation } from "react-router-dom";
import { Layout } from "./components/Layout";
import { WeightPage } from "./pages/WeightPage";
import { DailyPage } from "./pages/DailyPage";
import { TrendPage } from "./pages/TrendPage";
import { LandingPage } from "./pages/LandingPage";
import { AboutPage } from "./pages/AboutPage";
import { useAccount } from "./lib/account";
import { MealsProvider } from "./lib/data";
import { AccountChecking } from "./pages/LandingPage";
import { useDesiredPath } from "./hooks/useDesiredPath";

function HomeRoute() {
  const { status } = useAccount();
  const desiredPath = useDesiredPath();
  if (status === "ready") {
    return <Navigate to={desiredPath} replace />;
  }
  // Stay put while the account opens: a stale hint must not leave /daily in the URL.
  if (status === "opening") return null;
  return <LandingPage />;
}

// Gate that sends anyone without a ready account to the welcome screen, remembering
// the intended path. While the setup status is being confirmed, it waits in place.
function AuthedOutlet() {
  const { status } = useAccount();
  const location = useLocation();
  if (status === "opening") {
    // The page fills in once the account has opened; nothing in between.
    return null;
  }
  if (status === "checking") {
    return <AccountChecking />;
  }
  if (status !== "ready") {
    const redirect = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/?redirect=${redirect}`} replace />;
  }
  return (
    <MealsProvider>
      <Outlet />
    </MealsProvider>
  );
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
