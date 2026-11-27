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

/** Where to go once the account is ready: `?redirect=` if it names an app path. */
function useDesiredPath() {
  const redirect = new URLSearchParams(useLocation().search).get("redirect");
  return redirect && redirect.startsWith("/") ? redirect : "/daily";
}

function HomeRoute() {
  const { status } = useAccount();
  const desiredPath = useDesiredPath();
  if (status === "ready") {
    return <Navigate to={desiredPath} replace />;
  }
  return <LandingPage />;
}

// Gate that sends anyone without a ready account to the welcome screen, remembering
// the intended path. While the setup status is being confirmed, it waits in place.
function AuthedOutlet() {
  const { status } = useAccount();
  const location = useLocation();
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
