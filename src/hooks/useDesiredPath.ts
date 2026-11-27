import { useLocation } from "react-router-dom";

/** Where to go once the account is ready: `?redirect=` if it names an app path. */
export function useDesiredPath() {
  const redirect = new URLSearchParams(useLocation().search).get("redirect");
  return redirect && redirect.startsWith("/") ? redirect : "/daily";
}
