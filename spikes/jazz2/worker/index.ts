import { createJazz, durableObjects, acceptDeviceAccounts } from "jazz-tools/backend";
import { jazzWorker, type JazzWorkerEnv } from "jazz-tools/cloudflare";
import { app } from "../jazz.generated";
import permissions from "../jazz.permissions.json" with { type: "json" };

type Env = JazzWorkerEnv;

const worker = jazzWorker((env: Env) => {
  const jazz = createJazz({
    app,
    permissions,
    store: durableObjects({ binding: env.JAZZ }),
    authenticate: acceptDeviceAccounts,
  });
  return {
    jazz,
    fetch: async (req: Request) => {
      const url = new URL(req.url);
      if (url.pathname === "/api/health") return Response.json({ ok: true });
      return new Response("not found", { status: 404 });
    },
  };
});

export const { JazzCore, JazzBackend } = worker;
export default worker;
