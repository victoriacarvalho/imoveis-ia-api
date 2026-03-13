import { z } from "zod";

export const propertyTypeSchema = z.enum([
  "APARTAMENTO",
  "CASA",
  "COMERCIAL",
  "LOTE",
  "REPUBLICA",
  "QUARTO",
]);
export const transactionTypeSchema = z.enum(["VENDA", "ALUGUEL"]);
export const propertyStatusSchema = z.enum([
  "DISPONIVEL",
  "ALUGADO",
  "VENDIDO",
  "INATIVO",
]);

export const agencySchema = z.object({
  id: z.string(),
  name: z.string(),
  websiteUrl: z.string().nullable(),
  logoUrl: z.string().nullable(),
  primaryColor: z.string().nullable(),
});

export const propertySchema = z.object({
  id: z.string(),
  externalId: z.string().nullable(),
  title: z.string(),
  description: z.string().nullable(),
  transactionType: transactionTypeSchema,
  propertyType: propertyTypeSchema,
  price: z.number(),
  city: z.string(),
  state: z.string(),
  neighborhood: z.string().nullable(),
  bedrooms: z.number(),
  bathrooms: z.number(),
  parkingSpots: z.number(),
  area: z.number().nullable(),
  mainImage: z.string(),
  gallery: z.array(z.string()),
  status: propertyStatusSchema,
  isFurnished: z.boolean(),
  billsIncluded: z.boolean(),
  roomType: z.string().nullable(),
  genderRules: z.string().nullable(),
  agencyId: z.string(),
  agency: agencySchema.optional(),
  createdAt: z.date().or(z.string()),
});
