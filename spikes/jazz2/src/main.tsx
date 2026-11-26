import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import { JazzProvider, useAll, useDb, useJazzSession } from "jazz-tools/react";
import { app } from "../jazz.generated";
import { BrowserPasskeyBackup } from "jazz-tools/passkey-backup";
const passkeys = new BrowserPasskeyBackup({ appName: "Jazz spike" });
const restoreFromPasskey = async (s: { restoreDeviceAccount(k: string): Promise<void> }) => s.restoreDeviceAccount(await passkeys.restore());

function App() {
  const session = useJazzSession();
  const db = useDb();
  const { data, isLoading, error } = useAll(app.weightEntries);
  const [key, setKey] = useState("");
  Object.assign(window as any, { __session: session, __db: db, __app: app, __ids: data?.map((r) => r.id) });
  const [restoreKey, setRestoreKey] = useState("");
  return (
    <div>
      <p>status: <span data-testid="status">{session.status}</span></p>
      <p>user: <span data-testid="user">{session.user?.accountId ?? "none"}</span></p>
      <p>rows: <span data-testid="count">{isLoading ? "loading" : String(data?.length ?? 0)}</span></p>
      {error && <p data-testid="error">{String(error)}</p>}
      <ul data-testid="rows">
        {data?.map((r) => <li key={r.id} data-notes={r.notes ?? ""}>{r.timestamp} {r.weightValue} {r.notes}</li>)}
      </ul>
      <button onClick={() => db.insert(app.weightEntries, {
        timestamp: new Date().toISOString(), weightValue: 70 + Math.random(), unit: "kg", notes: "spike",
      })}>add</button>
      <button onClick={() => setKey(session.exportDeviceKey())}>export key</button>
      <pre data-testid="key">{key}</pre>
      <button onClick={() => passkeys.backup(session.exportDeviceKey(), "Spike user").then(() => setKey("backed-up"))}>backup passkey</button>
      <button onClick={() => restoreFromPasskey(session)}>restore passkey</button>
      <button onClick={() => session.signOut()}>sign out</button>
      <input data-testid="restore-input" value={restoreKey} onChange={(e) => setRestoreKey(e.target.value)} />
      <button onClick={() => session.restoreDeviceAccount(restoreKey)}>restore</button>
    </div>
  );
}

function SignedOut() {
  const session = useJazzSession();
  Object.assign(window as any, { __session: session });
  const [restoreKey, setRestoreKey] = useState("");
  return (
    <div>
      <p>status: <span data-testid="status">{session.status}</span></p>
      <button onClick={() => session.createDeviceAccount()}>new account</button>
      <button onClick={() => restoreFromPasskey(session)}>restore passkey</button>
      <input data-testid="restore-input" value={restoreKey} onChange={(e) => setRestoreKey(e.target.value)} />
      <button onClick={() => session.restoreDeviceAccount(restoreKey)}>restore</button>
    </div>
  );
}

(window as any).__classicProbe = () => import("./classic-probe").then((m) => m.probe());

(window as any).__classicLab = () => import("./classic-lab");

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <JazzProvider
      config={{
        serverUrl: "/jazz",
        initial: "device",
        client: () => import("jazz-tools/local-first"),
        localFirst: "now",
      }}
      signedOut={<SignedOut />}
      loading={<p data-testid="status">loading</p>}
      error={({ error }) => <p data-testid="status">error: {String(error)}</p>}
    >
      <App />
    </JazzProvider>
  </StrictMode>,
);
