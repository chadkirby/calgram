import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { nativeSetup, signInWithPasskey, startNewAccount, useAccount } from "@/lib/account";
import { classicIdentityFromHandle } from "@/migration/classicIdentity";
import { migrateFromPasskey } from "@/migration/migrate";

/** Shown while a signed-in account's setup status is being confirmed with the server. */
export function AccountChecking() {
  const { networkStatus } = useNetworkStatus();
  return (
    <output className="block text-sm text-muted-foreground text-center py-8">
      {networkStatus.isOnline
        ? "Checking your account…"
        : "You're offline. Waiting for a connection to finish setting up your account…"}
    </output>
  );
}

export function LandingPage() {
  const { status, saveProfile } = useAccount();

  // Name step: "Start" asks for a first name before creating anything.
  const [open, setOpen] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const errorId = useId();

  const openNameStep = () => {
    setMessage(null);
    setOpen(true);
  };

  const handleContinue = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      if (status === "signed-out") {
        // The signed-in tree takes over from here and leaves for ?redirect= or /daily.
        await startNewAccount(firstName);
      } else {
        saveProfile(nativeSetup(firstName));
      }
    } catch (error) {
      console.error("Starting failed:", error);
      setMessage("Couldn't start. Please try again.");
      setBusy(false);
    }
  };

  const handleReturning = async () => {
    setBusy(true);
    setMessage(null);
    const result = await signInWithPasskey();
    if (result.kind === "error") setMessage(result.message);
    setBusy(false);
    // A Classic passkey: migrate it (R5). The migration screens take over from here.
    if (result.kind === "classic") {
      await migrateFromPasskey(classicIdentityFromHandle(result.handle)).catch((error: unknown) => {
        console.error("Starting the migration failed:", error);
        setMessage("Couldn't open your account. Please try again.");
      });
    }
  };

  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center text-center gap-6 sm:gap-8 px-4 pb-16">
      {/* Optional small brand logo above hero, tasteful size */}
      <img src="/logo.webp" alt="Sammygram Calorie Tracker" className="h-10 sm:h-12 w-auto" />
      <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
        Calorie tracking for real life (and real pups)
      </h1>
      <p className="max-w-2xl text-sm sm:text-base text-muted-foreground">
        Built for anyone with a kitchen scale who wants simple, accurate calorie tracking and a
        clear picture of weight over time. Weigh food, log calories, and keep your subject on track.
      </p>

      {status === "checking" ? (
        <AccountChecking />
      ) : (
        <div className="flex flex-col items-center gap-3">
          <div className="flex items-center gap-3 sm:gap-4">
            <Button className="btn-touch px-5 sm:px-6" onClick={openNameStep} disabled={busy}>
              Start
            </Button>
            {status === "signed-out" && (
              <Button
                className="btn-touch px-5 sm:px-6"
                variant="outline"
                onClick={handleReturning}
                disabled={busy}
              >
                I've used Sammygram before
              </Button>
            )}
          </div>
          {/* While the name step is open, its error shows inside the dialog instead. */}
          {message && !open && (
            <p role="alert" className="max-w-md text-sm text-muted-foreground">
              {message}
            </p>
          )}
        </div>
      )}

      <div className="max-w-4xl grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 pt-2 sm:pt-4 text-left">
        <FeatureCard
          title="Weigh it, log it"
          text="Put the bowl on the scale, add food, and record it quickly. For packaged foods and treats, use the calories on the label. For everything else, make a reasonable estimate and keep moving."
          image="/Daily-Entries.webp"
          alt="Screenshot of quick daily entries flow"
        />
        <FeatureCard
          title="Daily clarity"
          text="See how much you’ve fed so far today and where those calories came from. The daily pie chart highlights your chosen categories (e.g., dry, wet, people food, treats)."
          image="/Daily-Chart.webp"
          alt="Screenshot of daily calories and pie chart breakdown"
        />
        <FeatureCard
          title="See what matters"
          text="Track calories in and weight over time to find a sustainable baseline. If weight drifts, your logs make adjusting simple and data‑driven."
          image="/Trend-Chart.webp"
          alt="Screenshot of trend chart showing calories and weight over time"
        />
      </div>

      <div className="max-w-4xl grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mt-2 sm:mt-4 text-left">
        <FeatureCard
          title="Flexible categories"
          text="Use categories that make sense for you—like “dry dog food”, “wet dog food”, “people food”, and “treats”. The breakdown makes over‑treating obvious (and fixable)."
        />
        <FeatureCard
          title="Small changes, big wins"
          text="One chew stick could be half a small dog’s day. Cutting treats into smaller pieces shifted most calories back to real meals. The app makes that visible."
        />
      </div>

      <div className="max-w-3xl pt-2 sm:pt-4 text-xs sm:text-sm text-muted-foreground">
        <p className="mt-2">
          Want the backstory?{" "}
          <a href="/about" className="underline hover:no-underline">
            Read Sammy’s story
          </a>
          .
        </p>
      </div>

      {/* Name step for Start */}
      <Dialog open={open} onOpenChange={(o) => !busy && setOpen(o)}>
        <DialogContent className="sm:max-w-[425px]" autoFocus={false}>
          <DialogHeader>
            <DialogTitle>Create your account</DialogTitle>
            <DialogDescription>This is how you'll be greeted in the app.</DialogDescription>
          </DialogHeader>
          <form
            className="grid gap-4 py-2"
            onSubmit={handleContinue}
            aria-describedby={message ? errorId : undefined}
          >
            <div className="grid gap-2">
              <Label htmlFor="firstName">First name</Label>
              <Input
                id="firstName"
                placeholder="Jane"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                autoFocus={false}
              />
            </div>
            {message && (
              <p id={errorId} role="alert" className="text-sm text-destructive">
                {message}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={busy}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={busy}>
                Continue
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FeatureCard({
  title,
  text,
  image,
  alt,
}: {
  title: string;
  text: string;
  image?: string;
  alt?: string;
}) {
  return (
    <div className="border rounded-lg p-4 text-left flex flex-col">
      <div className="font-medium mb-1">{title}</div>
      {/* Fixed-height text block to align images across cards */}
      <div className="text-sm text-muted-foreground min-h-[120px] sm:min-h-[110px] md:min-h-[100px]">
        {text}
      </div>
      {image ? (
        <div className="mt-3 -mx-1">
          <img
            src={image}
            alt={alt || ""}
            loading="lazy"
            width={640}
            height={360}
            className="w-full h-auto rounded-md border object-cover shadow-sm"
          />
        </div>
      ) : null}
    </div>
  );
}
