import { useEffect, useMemo, useState } from "react";
import { useAccount, useIsAuthenticated, usePasskeyAuth } from "jazz-tools/react";
import { APPLICATION_NAME } from "../Main";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { JazzAccount } from "../schema";
import { useLocation, useNavigate } from "react-router-dom";

export function LandingPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const isAuthenticated = useIsAuthenticated();

  // Track where user originally wanted to go (e.g., /weight) so we can send them there post-auth
  const desiredPath = useMemo(() => {
    const p = new URLSearchParams(location.search).get("redirect");
    return p && p.startsWith("/") ? p : "/daily";
  }, [location.search]);

  const { me } = useAccount(JazzAccount, { resolve: { profile: true } });
  const auth = usePasskeyAuth({ appName: APPLICATION_NAME });

  // Sign-up dialog state
  const [open, setOpen] = useState(false);
  const [firstName, setFirstName] = useState("");

  // Open dialog when URL has ?signup=1 or when user clicks Sign up
  useEffect(() => {
    const isSignup = new URLSearchParams(location.search).get("signup") === "1";
    if (isSignup) {
      setOpen(true);
    }
  }, [location.search]);

  // If already authenticated, go to desiredPath immediately
  useEffect(() => {
    if (isAuthenticated) {
      navigate(desiredPath, { replace: true });
    }
  }, [isAuthenticated, desiredPath, navigate]);

  // Initialize local firstName once from profile when dialog opens
  useEffect(() => {
    if (open && me?.profile) {
      setFirstName(me.profile.firstName ?? "");
    }
    // Only run when opening, or when profile changes while open
  }, [open, me?.profile?.firstName]);

  // IMPORTANT: Do NOT trigger auth.signUp() automatically.
  // Only run the passkey flow after the user clicks Continue in the dialog.
  const openSignup = () => setOpen(true);

  const handleContinue = async () => {
    try {
      // Persist firstName before starting auth, so the profile is ready after sign-in
      if (me?.profile) {
        me.profile.firstName = (firstName || "").trim() || "Nobody";
        if (!me.profile.name || me.profile.name === "Anonymous user") {
          me.profile.name = me.profile.firstName;
        }
      }
      // Now start the passkey flow with a meaningful WebAuthn user name
      const label = `Calorie Tracker (${(firstName || "").trim() || "User"})`;
      await auth.signUp(label);
      // After successful signup, redirect will be handled by the isAuthenticated effect
      // but also navigate here as a fallback
      navigate(desiredPath, { replace: true });
    } catch (e) {
      console.error("Sign up failed:", e);
    }
  };

  const handleCancel = () => {
    setOpen(false);
  };

  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center text-center gap-6 sm:gap-8 px-4">
      <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
        Calorie tracking for real life (and real pups)
      </h1>
      <p className="max-w-2xl text-sm sm:text-base text-muted-foreground">
        Built for anyone with a kitchen scale who wants simple, accurate calorie tracking and
        a clear picture of weight over time. Weigh food, log calories, and keep your subject on track.
      </p>

      <div className="flex items-center gap-3 sm:gap-4">
        <Button className="btn-touch px-5 sm:px-6" onClick={openSignup}>
          Sign up
        </Button>
        <Button
          className="btn-touch px-5 sm:px-6"
          variant="outline"
          onClick={() => auth.logIn()}
        >
          Log in
        </Button>
      </div>

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
          text='Use categories that make sense for you—like “dry dog food”, “wet dog food”, “people food”, and “treats”. The breakdown makes over‑treating obvious (and fixable).'
        />
        <FeatureCard
          title="Small changes, big wins"
          text="One chew stick could be half a small dog’s day. Cutting treats into smaller pieces shifted most calories back to real meals. The app makes that visible."
        />
      </div>

      <div className="max-w-3xl pt-2 sm:pt-4 text-xs sm:text-sm text-muted-foreground">
        <p className="mt-2">
          Want the backstory? <a href="/about" className="underline hover:no-underline">Read Sammy’s story</a>.
        </p>
      </div>

      {/* Sign-up modal dialog on the landing page */}
      <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : handleCancel())}>
        <DialogContent className="sm:max-w-[425px]" autoFocus={false}>
          <DialogHeader>
            <DialogTitle>Create your account</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="firstName">First name</Label>
              <Input
                id="firstName"
                placeholder="Jane"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                autoFocus
              />
              <p className="text-xs text-muted-foreground">
                We’ll label your passkey as Calorie Tracker ({firstName || "User"}).
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={handleCancel}>
                Cancel
              </Button>
              <Button onClick={handleContinue}>
                Continue
              </Button>
            </div>
          </div>
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
