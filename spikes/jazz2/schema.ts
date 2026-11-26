import { schema as s } from "jazz-tools";

export const schema = s.defineSchema({
  weightEntries: s.table({
    timestamp: s.string(),
    weightValue: s.float(),
    unit: s.enum("lbs", "kg").optional(),
    notes: s.string().optional(),
  }),
});

const { definePermissions, session } = schema;
const mine = { $createdBy: session.user };

export const permissions = definePermissions({
  weightEntries: { read: mine, insert: true, update: mine, delete: mine },
});

