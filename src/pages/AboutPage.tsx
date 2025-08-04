import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function AboutPage() {
  return (
    <div className="max-w-3xl mx-auto space-y-6 sm:space-y-8 px-6 sm:px-8 pb-16 pt-4">
      <header className="text-center space-y-2">
        <div className="flex items-center justify-center gap-2">
          <img src="/logo.webp" alt="Sammygram Calorie Tracker" className="h-8 w-auto" />
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">About Sammygram Calorie Tracker</h1>
        <p className="text-sm sm:text-base text-muted-foreground">
          A simple, accurate way to track calories and weight using a kitchen scale.
        </p>
      </header>

      <figure className="mx-auto max-w-md px-1 sm:px-0">
        <img
          src="/Sammy-and-Dad.webp"
          alt="Sammy the Pom‑Chi with his human"
          className="w-full h-auto rounded-lg border object-cover shadow-sm"
          loading="lazy"
        />
        <figcaption className="mt-2 text-center text-xs text-muted-foreground px-3">
          Sammy (Pom‑Chi) and dad. Small changes. Big wins.
        </figcaption>
      </figure>

      <Card>
        <CardHeader>
          <CardTitle>Sammy, the Pom‑Chi who spawned an app</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm sm:text-base leading-relaxed">
          <p>
            Sammygram Calorie Tracker began with Sammy, a 14.5 lb Pom‑Chi who put on about a pound over the holidays.
            That doesn’t sound like much—until you realize it’s a big deal for a small dog.
          </p>
          <p>
            With a kitchen scale and a lightweight logging flow, we started weighing meals, logging calories,
            and tracking weight over time. Within a few weeks, the trends made things obvious:
            treats added up fast. A single chew stick could be half his daily calories.
          </p>
          <p>
            By cutting treats into smaller pieces and shifting calories toward real meals, Sammy’s weight
            stabilized back into a healthy range. The app made the problem visible—and the fix simple.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>How it works</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm sm:text-base leading-relaxed">
          <ul className="list-disc pl-5 space-y-2">
            <li>Put the bowl on the scale, add food, and log it—fast.</li>
            <li>Use calories from packaging when available; estimate reasonably for everything else.</li>
            <li>Assign categories that make sense (e.g., dry, wet, people food, treats).</li>
            <li>See today’s total and a pie chart breakdown by category.</li>
            <li>Track calories and weight over time so adjustments are data‑driven, not guesswork.</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Why it works</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm sm:text-base leading-relaxed">
          <p>
            Small, consistent measurements beat complex plans. Logging makes hidden calories visible,
            trends show whether weight is moving in the right direction, and simple tweaks keep things
            sustainable.
          </p>
        </CardContent>
      </Card>

      <div className="flex items-center justify-center gap-3 pt-2">
        <Link to="/">
          <Button className="btn-touch px-5">Back to Home</Button>
        </Link>
      </div>
    </div>
  );
}
