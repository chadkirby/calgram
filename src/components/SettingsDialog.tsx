import { useState } from "react";
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
import { useAccount, useSavePasskey } from "@/lib/account";

export function SettingsDialog() {
  const { profile, saveProfile } = useAccount();
  const { save: savePasskey, state: passkeyState } = useSavePasskey();

  const [open, setOpen] = useState(false);
  const [fullName, setFullName] = useState("");
  const [firstName, setFirstName] = useState("");

  // Initialize form values when dialog opens
  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen && profile) {
      setFullName(profile.name || "");
      setFirstName(profile.firstName || "");
    }
    setOpen(newOpen);
  };

  const handleSave = () => {
    if (profile) {
      saveProfile({ name: fullName.trim() || null, firstName: firstName.trim() || null });
    }
    setOpen(false);
  };

  const handleCancel = () => {
    // Reset form values to original
    if (profile) {
      setFullName(profile.name || "");
      setFirstName(profile.firstName || "");
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
      <DialogContent className="sm:max-w-[425px] max-h-[90vh] flex flex-col" autoFocus={false}>
        <DialogHeader className="shrink-0">
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>Manage your profile and application settings.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 flex-1 overflow-y-auto">
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
                <Button onClick={handleSave}>Save Changes</Button>
              </div>
            </CardContent>
          </Card>

          {/* Passkey Card */}
          <Card>
            <CardHeader>
              <CardTitle>Passkey</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Save a passkey to get back into your account on another device or after logging out.
              </p>
              <Button variant="outline" onClick={savePasskey} disabled={passkeyState === "saving"}>
                Save a passkey
              </Button>
              {passkeyState === "saved" && <p className="text-sm">Passkey saved.</p>}
              {passkeyState === "error" && (
                <p role="alert" className="text-sm text-destructive">
                  Couldn't save a passkey. Please try again.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Data Card */}
          <DataCard />
        </div>
      </DialogContent>
    </Dialog>
  );
}
