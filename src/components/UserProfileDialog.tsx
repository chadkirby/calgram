import { useState } from "react";
import { useAccount } from "jazz-tools/react";
import { PencilIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { JazzAccount } from "../schema";

interface UserProfileDialogProps {
  isAuthenticated: boolean;
}

export function UserProfileDialog({ isAuthenticated }: UserProfileDialogProps) {
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

  const buttonText = isAuthenticated ? "Edit Profile" : "Set Name";
  const buttonTitle = isAuthenticated ? "Edit your profile" : "Set your name";

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <button
          className="bg-stone-100 py-1 px-2 sm:py-1.5 sm:px-3 text-xs sm:text-sm rounded-md touch-manipulation flex items-center gap-1 sm:gap-2"
          title={buttonTitle}
        >
          <PencilIcon className="w-3 h-3 sm:w-4 sm:h-4" />
          <span className="sm:hidden">Edit</span>
          <span className="hidden sm:inline">{buttonText}</span>
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit Profile</DialogTitle>
          <DialogDescription>
            Update your profile information. Changes will be saved automatically.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="fullName">Full Name</Label>
            <Input
              id="fullName"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Enter your full name"
              className="w-full"
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
            />
            <p className="text-xs text-muted-foreground">
              This is how you'll be greeted in the app
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
