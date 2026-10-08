import { z } from "zod";
import { isOffshore } from "./domain";
import {
  ACTIONS,
  CATEGORIES,
  CERT_INTENTS,
  LOCATIONS,
  ROLES,
  UNITS,
} from "../types";

const locationSchema = z.enum(LOCATIONS);
const certIntentSchema = z.enum(CERT_INTENTS);

export const itemSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  sku: z.string().min(1),
  serial: z.string(),
  category: z.enum(CATEGORIES),
  location: locationSchema,
  bin: z.string().min(1),
  quantity: z.number().int().nonnegative(),
  unit: z.enum(UNITS),
  unitCost: z.number().nonnegative(),
  reorderPoint: z.number().int().nonnegative(),
  onOrder: z.number().int().nonnegative(),
  certification: certIntentSchema,
  certBody: z.string(),
  certExpiry: z.string(),
  manufacturer: z.string(),
  updatedAt: z.string(),
});

export const movementSchema = z.object({
  id: z.string().min(1),
  at: z.string().min(1),
  actor: z.string().min(1),
  role: z.enum(ROLES),
  action: z.enum(ACTIONS),
  itemId: z.string().min(1),
  itemName: z.string(),
  sku: z.string(),
  quantity: z.number().int(),
  unit: z.string(),
  location: z.string(),
  destination: z.string(),
  wellId: z.string(),
  note: z.string(),
  prevHash: z.string().regex(/^[0-9a-f]{8}$/),
  hash: z.string().regex(/^[0-9a-f]{8}$/),
  reference: z.string().min(4),
});

export const transferSchema = z.object({
  id: z.string().min(1),
  itemId: z.string().min(1),
  itemName: z.string(),
  sku: z.string(),
  quantity: z.number().int().positive(),
  unit: z.string(),
  unitCost: z.number().nonnegative(),
  from: locationSchema,
  to: locationSchema,
  wellId: z.string(),
  status: z.enum(["In Transit", "Received"]),
  departedAt: z.string(),
  receivedAt: z.string().optional(),
  reference: z.string(),
  actor: z.string(),
});

export const reorderSchema = z.object({
  id: z.string().min(1),
  itemId: z.string().min(1),
  itemName: z.string(),
  sku: z.string(),
  quantity: z.number().int().positive(),
  unit: z.string(),
  unitCost: z.number().nonnegative(),
  vendor: z.string(),
  status: z.enum(["Pending", "Approved", "Rejected"]),
  requestedAt: z.string(),
  requestedBy: z.string(),
  decidedAt: z.string().optional(),
  decidedBy: z.string().optional(),
  note: z.string(),
});

export const appDataSchema = z.object({
  items: z.array(itemSchema).min(1),
  movements: z.array(movementSchema),
  transfers: z.array(transferSchema),
  reorders: z.array(reorderSchema),
});

export const sessionSchema = z.object({
  role: z.enum(ROLES),
  name: z.string().min(1),
  title: z.string().min(1),
  base: z.string().min(1),
  signedInAt: z.string().min(1),
});

const wholeNumber = (label: string, min: number, max: number) =>
  z
    .string()
    .trim()
    .min(1, `Enter ${label}.`)
    .transform((value, ctx) => {
      if (!/^\d+$/.test(value)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `${label} must be a whole number.`,
        });
        return z.NEVER;
      }
      const parsed = Number(value);
      if (parsed < min || parsed > max) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `${label} must be between ${min.toLocaleString("en-US")} and ${max.toLocaleString("en-US")}.`,
        });
        return z.NEVER;
      }
      return parsed;
    });

const moneyField = z
  .string()
  .trim()
  .min(1, "Enter the unit cost.")
  .transform((value, ctx) => {
    if (!/^\d+(\.\d{1,2})?$/.test(value) || Number(value) <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Enter a unit cost greater than zero.",
      });
      return z.NEVER;
    }
    return Math.round(Number(value) * 100) / 100;
  });

function expiryIssues(
  certification: "Valid" | "Pending Review",
  certExpiry: string,
  ctx: z.RefinementCtx,
) {
  if (certification === "Pending Review") return;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(certExpiry)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["certExpiry"],
      message: "Enter the certificate expiry.",
    });
  }
}

export const addItemSchema = z
  .object({
    name: z.string().trim().min(3, "Enter the item name.").max(120),
    sku: z
      .string()
      .trim()
      .min(3, "Enter a SKU.")
      .max(40)
      .transform((value) => value.toUpperCase()),
    serial: z.string().trim().max(48),
    category: z.enum(CATEGORIES),
    manufacturer: z.string().trim().min(2, "Enter the manufacturer.").max(80),
    unit: z.enum(UNITS),
    location: locationSchema,
    bin: z.string().trim().min(2, "Enter the bin.").max(24),
    quantity: wholeNumber("a quantity", 1, 1_000_000),
    unitCost: moneyField,
    reorderPoint: wholeNumber("a reorder point", 0, 1_000_000),
    certification: certIntentSchema,
    certBody: z.string().trim().min(2, "Enter the certifying standard.").max(40),
    certExpiry: z.string(),
  })
  .superRefine((value, ctx) => {
    expiryIssues(value.certification, value.certExpiry, ctx);
  });

export const editSchema = (originalQty: number) =>
  z
    .object({
      quantity: wholeNumber("the on-hand quantity", 0, 1_000_000),
      bin: z.string().trim().min(2, "Enter the bin.").max(24),
      reason: z.string(),
      certification: certIntentSchema,
      certExpiry: z.string(),
    })
    .superRefine((value, ctx) => {
      if (value.quantity !== originalQty && !value.reason) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["reason"],
          message: "Select a reason for the quantity change.",
        });
      }
      expiryIssues(value.certification, value.certExpiry, ctx);
    });

export const checkInSchema = z.object({
  quantity: wholeNumber("a quantity", 1, 1_000_000),
  bin: z.string().trim().min(2, "Enter the receiving bin.").max(24),
  note: z.string().trim().min(3, "Enter the goods receipt reference.").max(240),
});

export function issueSchema(onHand: number, from: string) {
  return z
    .object({
      quantity: wholeNumber("a quantity", 1, 1_000_000),
      destination: locationSchema,
      wellId: z.string(),
      note: z.string().trim().max(240, "Keep the note under 240 characters."),
    })
    .superRefine((value, ctx) => {
      if (value.quantity > onHand) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["quantity"],
          message: `Only ${onHand.toLocaleString("en-US")} on hand.`,
        });
      }
      if (value.destination === from) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["destination"],
          message: "Choose a different location.",
        });
      }
      if (isOffshore(value.destination) && !value.wellId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["wellId"],
          message: "Select the destination well.",
        });
      }
    });
}

export const reorderRequestSchema = z.object({
  quantity: wholeNumber("a quantity", 1, 1_000_000),
  vendor: z.string().trim().min(2, "Enter the vendor.").max(80),
  note: z.string().trim().max(240, "Keep the note under 240 characters."),
});

export const receiveTransferSchema = z.object({
  bin: z.string().trim().min(2, "Enter the receiving bin.").max(24),
  note: z.string().trim().max(240, "Keep the note under 240 characters."),
});

export const decideSchema = z.object({
  note: z.string().trim().max(240, "Keep the note under 240 characters."),
});

export function fieldErrors(error: z.ZodError) {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path[0];
    if (typeof key === "string" && !errors[key]) errors[key] = issue.message;
  }
  return errors;
}

export type NewItem = z.infer<typeof addItemSchema>;
export type EditInput = z.infer<ReturnType<typeof editSchema>>;
export type CheckInInput = z.infer<typeof checkInSchema>;
export type IssueInput = z.infer<ReturnType<typeof issueSchema>>;
export type ReorderInput = z.infer<typeof reorderRequestSchema>;
export type ReceiveInput = z.infer<typeof receiveTransferSchema>;
export type DecideInput = z.infer<typeof decideSchema>;
