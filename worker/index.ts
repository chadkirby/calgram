import { acceptDeviceAccounts, createJazz, durableObjects } from "jazz-tools/backend";
import { jazzWorker } from "jazz-tools/cloudflare";
import { app } from "../jazz/jazz.generated";
import permissions from "../jazz/jazz.permissions.json" with { type: "json" };

// Jazz 2 sync lives at /jazz, backed by the JazzCore and JazzBackend Durable
// Objects. Their class, binding and Worker names are permanent once data exists.
const worker = jazzWorker((env: Env) => ({
  jazz: createJazz({
    app,
    permissions,
    store: durableObjects({ binding: env.JAZZ }),
    authenticate: acceptDeviceAccounts,
    // The Inspector reads every user's rows without permission checks. Off.
    inspect: () => null,
  }),
  fetch: async (request: Request) => {
    const url = new URL(request.url);

    if (url.pathname.startsWith("/api/")) {
      return Response.json({
        name: "Cloudflare",
      });
    }
    return new Response(null, { status: 404 });
  },
}));

export const { JazzCore, JazzBackend } = worker;
export default worker;
