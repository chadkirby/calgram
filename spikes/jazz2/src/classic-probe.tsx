// Proves the Classic client can live in the same bundle as Jazz 2, under an alias.
import { co, z, Account, Group } from "jazz-classic";
import { JazzReactProvider, usePasskeyAuth, useAccount } from "jazz-classic/react";
export const ClassicAccount = co.account({ profile: co.profile(), root: co.map({ dateOfBirth: z.string().optional() }) });
export const probe = () => ({
  co: typeof co.map, Account: typeof Account, Group: typeof Group,
  JazzReactProvider: typeof JazzReactProvider, usePasskeyAuth: typeof usePasskeyAuth, useAccount: typeof useAccount,
});
