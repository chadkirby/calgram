import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { AuthButton } from "../AuthButton";
import { SettingsDialog } from "./SettingsDialog";
import { PasskeyOffer } from "./PasskeyOffer";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SettingsIcon } from "lucide-react";
import { useDesiredPath } from "@/hooks/useDesiredPath";
import { useAccount } from "@/lib/account";

const controlClass =
  "bg-stone-100 py-1 px-2 sm:py-1.5 sm:px-3 text-xs sm:text-sm rounded-md text-muted-foreground";

/**
 * Settings and Log out while the account opens (the launch hint): the same size and
 * place as the real buttons, so nothing moves, but inert, since they need the session.
 */
function OpeningControls() {
  return (
    <span aria-hidden="true" className="flex items-center gap-2 sm:gap-3">
      <span className={`${controlClass} flex items-center`}>
        <SettingsIcon className="w-3 h-3 sm:w-4 sm:h-4" />
      </span>
      <span className={controlClass}>
        <span className="sm:hidden">Logout</span>
        <span className="hidden sm:inline">Log out</span>
      </span>
    </span>
  );
}

export function Layout() {
  const { status, profile } = useAccount();
  const isOpening = status === "opening";
  // While the account opens, show the signed-in app (tabs and all), not the welcome.
  const isAuthenticated = status === "ready" || isOpening;
  const navigate = useNavigate();
  const location = useLocation();

  const desiredPath = useDesiredPath();
  // Opening at the home page, show the tab the account will land on.
  const tabPath =
    isOpening && location.pathname === "/" ? desiredPath.split(/[?#]/)[0] : location.pathname;
  const currentTab = tabPath.slice(1) || "meals";

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
              {/* Mobile: prefer short name; if space allows, show logo + long name */}
              <span className="text-sm font-semibold truncate">Sammygram</span>
              {/* Optional logo + long name when space permits; hidden by default for compactness */}
              <div className="hidden xs:flex items-center gap-2 truncate">
                <img
                  src="/logo.webp"
                  alt=""
                  className="h-5 w-auto flex-shrink-0"
                  height="20"
                  width="80"
                />
                <span className="text-sm font-semibold truncate">Sammygram Calorie Tracker</span>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {isAuthenticated && (
                <div className="w-2 h-2 bg-green-500 rounded-full" title="Logged in" />
              )}
              {isOpening ? (
                <OpeningControls />
              ) : (
                <>
                  {isAuthenticated && <SettingsDialog />}
                  <AuthButton />
                </>
              )}
            </div>
          </div>

          {/* Desktop header */}
          <div className="hidden sm:flex justify-between items-center p-4 gap-4">
            <div className="flex items-center gap-3">
              <img
                src="/logo.webp"
                alt="Sammygram Calorie Tracker"
                className="h-7 w-auto"
                height="28"
                width="112"
              />
              <h1 className="text-lg lg:text-xl font-semibold truncate">
                Sammygram Calorie Tracker
              </h1>
              {isAuthenticated && profile?.firstName && profile.firstName !== "Nobody" && (
                <span className="text-sm text-muted-foreground truncate">
                  Welcome, {profile.firstName}!
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              {isAuthenticated ? (
                <span className="text-sm text-muted-foreground">Logged in</span>
              ) : (
                <span className="text-sm text-muted-foreground">Authenticate to sync data</span>
              )}
              {isOpening ? (
                <OpeningControls />
              ) : (
                <>
                  {isAuthenticated && <SettingsDialog />}
                  <AuthButton />
                </>
              )}
            </div>
          </div>
        </nav>
      </header>

      <main className="max-w-7xl mx-auto p-1 sm:p-4 lg:p-6">
        {isAuthenticated ? (
          <Tabs value={currentTab} onValueChange={handleTabChange} className="w-full">
            <TabsList
              data-testid="main-tabs"
              className="grid w-full grid-cols-3 h-auto mb-0 sm:mb-6"
            >
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

            {!isOpening && <PasskeyOffer />}
            <div className="mt-1 sm:mt-4">
              <Outlet />
            </div>
          </Tabs>
        ) : (
          <div className="mt-1 sm:mt-4">
            <Outlet />
          </div>
        )}
      </main>
    </div>
  );
}
