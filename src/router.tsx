import { createBrowserRouter, Navigate } from "react-router-dom";
import { Layout } from "./components/Layout";
import { MealPage } from "./pages/MealPage";
import { WeightPage } from "./pages/WeightPage";
import { DailyPage } from "./pages/DailyPage";
import { TrendPage } from "./pages/TrendPage";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <Layout />,
    children: [
      { index: true, element: <Navigate to="/meals" replace /> },
      { path: "meals", element: <MealPage /> },
      { path: "weight", element: <WeightPage /> },
      { path: "daily", element: <DailyPage /> },
      { path: "trends", element: <TrendPage /> },
    ],
  },
]);