import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { useAccount, useIsAuthenticated } from "jazz-tools/react";
import { AuthButton } from "../AuthButton";
import { JazzAccount } from "../schema";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function Layout() {
  const { me } = useAccount(JazzAccount, {
    resolve: { profile: true, root: true },
  });
  const isAuthenticated = useIsAuthenticated();
  const navigate = useNavigate();
  const location = useLocation();

  const currentTab = location.pathname.slice(1) || "meals";

  const handleTabChange = (value: string) => {
    navigate(`/${value}`);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <nav className="max-w-4xl mx-auto flex justify-between items-center p-4">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-semibold">Calorie Tracker</h1>
            {me?.profile?.firstName && (
              <span className="text-muted-foreground">
                Welcome, {me.profile.firstName}!
              </span>
            )}
          </div>
          <div className="flex items-center gap-4">
            {isAuthenticated ? (
              <span className="text-sm text-muted-foreground">Logged in</span>
            ) : (
              <span className="text-sm text-muted-foreground">
                Authenticate to sync data
              </span>
            )}
            <AuthButton />
          </div>
        </nav>
      </header>

      <main className="max-w-4xl mx-auto p-4">
        <Tabs value={currentTab} onValueChange={handleTabChange} className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="meals">Meals</TabsTrigger>
            <TabsTrigger value="weight">Weight</TabsTrigger>
            <TabsTrigger value="daily">Daily</TabsTrigger>
            <TabsTrigger value="trends">Trends</TabsTrigger>
          </TabsList>
          
          <div className="mt-6">
            <Outlet />
          </div>
        </Tabs>
      </main>
    </div>
  );
}