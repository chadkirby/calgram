import { useState } from "react";
import { useAccount } from "jazz-tools/react";
import { SettingsIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataCard } from "@/components/DataCard";
import { JazzAccount } from "../schema";

export function SettingsDialog() {
  const { me } = useAccount(JazzAccount, {
    resolve: { profile: true },
  });

  const [open, setOpen] = useState(false);
  const [fullName, setFullName] = useState("");
  const [firstName, setFirstName] = useState("");

  // Initialize form values when dialog opens
  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen && me?.profile) {
      setFullName(me.profile.name || "");
      setFirstName(me.profile.firstName || "");
    }
    setOpen(newOpen);
  };

  const handleSave = () => {
    if (me?.profile) {
      // Update the profile data - Jazz handles synchronization automatically
      me.profile.name = fullName.trim() || "Anonymous user";
      me.profile.firstName = firstName.trim() || "Nobody";
    }
    setOpen(false);
  };

  const handleCancel = () => {
    // Reset form values to original
    if (me?.profile) {
      setFullName(me.profile.name || "");
      setFirstName(me.profile.firstName || "");
    }
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <button
          className="bg-stone-100 py-1 px-2 sm:py-1.5 sm:px-3 text-xs sm:text-sm rounded-md touch-manipulation flex items-center gap-1 sm:gap-2"
          title="Application settings"
        >
          <SettingsIcon className="w-3 h-3 sm:w-4 sm:h-4" />
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]" autoFocus={false}>
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>
            Manage your profile and application settings.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          {/* Profile Card */}
          <Card>
            <CardHeader>
              <CardTitle>Profile</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="fullName">Full Name</Label>
                <Input
                  id="fullName"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Enter your full name"
                  className="w-full"
                  autoFocus={false}
                  tabIndex={-1}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="firstName">First Name</Label>
                <Input
                  id="firstName"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="Enter your first name"
                  className="w-full"
                  autoFocus={false}
                  tabIndex={-1}
                />
                <p className="text-xs text-muted-foreground">
                  This is how you'll be greeted in the app
                </p>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={handleCancel}>
                  Cancel
                </Button>
                <Button onClick={handleSave}>
                  Save Changes
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Data Card */}
          <DataCard />
        </div>
      </DialogContent>
    </Dialog>
  );
}
