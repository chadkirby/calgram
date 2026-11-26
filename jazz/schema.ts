// Jazz 2 schema for calgram. Run `pnpm jazz:generate` after editing, and commit
// jazz.app.json, jazz.permissions.json and jazz.generated.ts.
import { schema as s } from "jazz-tools";

const mealUnit = () => s.enum("g", "oz", "lb", "kg");

export const schema = s.defineSchema({
  mealEntries: s.table({
    // Stored verbatim: offset ISO datetimes or date-only strings (plan KTD10).
    timestamp: s.string(),
    foodName: s.string(),
    foodCategory: s.string(),
    caloriesPerGram: s.float(),
    caloriesPerDisplayUnit: mealUnit().optional(),
    weightInGrams: s.float(),
    displayUnit: mealUnit().optional(),
    totalCalories: s.float(),
    notes: s.string().optional(),
  }),
  weightEntries: s.table({
    timestamp: s.string(),
    weightValue: s.float(),
    unit: s.enum("lbs", "kg").optional(),
    notes: s.string().optional(),
  }),
  profile: s.table({
    name: s.string().optional(),
    firstName: s.string().optional(),
    mealWeightUnit: mealUnit().optional(),
    bodyWeightUnit: s.enum("lbs", "kg").optional(),
    classicAccountId: s.string().optional(),
    // "native": started fresh; "migrated": Classic data copied (plan KTD6).
    setupStatus: s.enum("native", "migrated").optional(),
  }),
});

const { definePermissions, session } = schema;
const mine = { $createdBy: session.user };
const ownerOnly = { read: mine, insert: true, update: mine, delete: mine };

export const permissions = definePermissions({
  mealEntries: ownerOnly,
  weightEntries: ownerOnly,
  profile: ownerOnly,
});
