"use client";

import { useAccount, usePasskeyAuth } from "jazz-tools/react";
import { APPLICATION_NAME } from "./Main";

export function AuthButton() {
  const { logOut } = useAccount();

  const auth = usePasskeyAuth({
    appName: APPLICATION_NAME,
  });

  function handleLogOut() {
    logOut();
    window.history.pushState({}, "", "/");
  }

  if (auth.state === "signedIn") {
    return (
      <button
        className="bg-stone-100 py-1 px-2 sm:py-1.5 sm:px-3 text-xs sm:text-sm rounded-md touch-manipulation"
        onClick={handleLogOut}
        title="Log out"
      >
        <span className="sm:hidden">Logout</span>
        <span className="hidden sm:inline">Log out</span>
      </button>
    );
  }

  return (
    <div className="flex gap-1 sm:gap-2">
      <button
        onClick={() => auth.logIn()}
        className="bg-stone-100 py-1 px-2 sm:py-1.5 sm:px-3 text-xs sm:text-sm rounded-md touch-manipulation"
      >
        <span className="sm:hidden">Log in</span>
        <span className="hidden sm:inline">Log in</span>
      </button>
    </div>
  );
}
