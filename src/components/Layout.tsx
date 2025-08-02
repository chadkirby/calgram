import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { useAccount, useIsAuthenticated } from "jazz-tools/react";
import { AuthButton } from "../AuthButton";
import { SettingsDialog } from "./SettingsDialog";
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
      <header className="border-b sticky top-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 z-50">
        <nav className="max-w-7xl mx-auto">
          {/* Mobile compact header */}
          <div className="sm:hidden flex items-center justify-between p-2 min-h-[48px]">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <h1 className="text-sm font-semibold truncate">Calorie Tracker</h1>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {isAuthenticated && (
                <div className="w-2 h-2 bg-green-500 rounded-full" title="Logged in" />
              )}
              <SettingsDialog />
              <AuthButton />
            </div>
          </div>

          {/* Desktop header */}
          <div className="hidden sm:flex justify-between items-center p-4 gap-4">
            <div className="flex items-center gap-3">
              <h1 className="text-lg lg:text-xl font-semibold truncate">Calorie Tracker</h1>
              {me?.profile?.firstName && (
                <span className="text-sm text-muted-foreground truncate">
                  Welcome, {me.profile.firstName}!
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              {isAuthenticated ? (
                <span className="text-sm text-muted-foreground">Logged in</span>
              ) : (
                <span className="text-sm text-muted-foreground">
                  Authenticate to sync data
                </span>
              )}
              <SettingsDialog />
              <AuthButton />
            </div>
          </div>
        </nav>
      </header>

      <main className="max-w-7xl mx-auto p-1 sm:p-4 lg:p-6">
        <Tabs value={currentTab} onValueChange={handleTabChange} className="w-full">
          <TabsList className="grid w-full grid-cols-3 h-auto mb-0 sm:mb-6">
            <TabsTrigger
              value="daily"
              className="text-xs sm:text-sm py-1.5 sm:py-3 px-1 sm:px-3 flex items-center justify-center gap-1 sm:gap-2 min-h-[40px] sm:min-h-[2.5rem]"
            >
              <span className="text-sm sm:hidden">🍽️</span>
              <span className="hidden sm:inline">Daily</span>
              <span className="sm:hidden text-[10px] leading-tight ml-1">Daily</span>
            </TabsTrigger>
            <TabsTrigger
              value="weight"
              className="text-xs sm:text-sm py-1.5 sm:py-3 px-1 sm:px-3 flex items-center justify-center gap-1 sm:gap-2 min-h-[40px] sm:min-h-[2.5rem]"
            >
              <span className="text-sm sm:hidden">⚖️</span>
              <span className="hidden sm:inline">Weight</span>
              <span className="sm:hidden text-[10px] leading-tight ml-1">Weight</span>
            </TabsTrigger>
            <TabsTrigger
              value="trends"
              className="text-xs sm:text-sm py-1.5 sm:py-3 px-1 sm:px-3 flex items-center justify-center gap-1 sm:gap-2 min-h-[40px] sm:min-h-[2.5rem]"
            >
              <span className="text-sm sm:hidden">📈</span>
              <span className="hidden sm:inline">Trends</span>
              <span className="sm:hidden text-[10px] leading-tight ml-1">Trends</span>
            </TabsTrigger>
          </TabsList>

          <div className="mt-1 sm:mt-4">
            <Outlet />
          </div>
        </Tabs>
      </main>
    </div>
  );
}
