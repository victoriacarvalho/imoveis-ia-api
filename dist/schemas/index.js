import { z } from "zod";
export const createPropertyBodySchema = z.object({
    title: z.string().trim().min(1, "O título é obrigatório"),
    description: z.string().optional(),
    transactionType: z.enum(["VENDA", "ALUGUEL"]),
    propertyType: z.enum([
        "APARTAMENTO",
        "CASA",
        "COMERCIAL",
        "LOTE",
        "REPUBLICA",
        "QUARTO",
    ]),
    price: z.number().positive("O preço deve ser maior que zero"),
    city: z.string().trim().min(1, "A cidade é obrigatória"),
    state: z.string().length(2, "Use a sigla do estado (Ex: MG)"),
    neighborhood: z.string().optional(),
    bedrooms: z.number().int().nonnegative().default(0),
    bathrooms: z.number().int().nonnegative().default(0),
    mainImage: z.string().url("A imagem principal deve ser um link válido"),
    agencyId: z.string().min(1, "O ID da agência é obrigatório"),
});
export const propertyResponseSchema = z.object({
    id: z.string(),
    title: z.string(),
    propertyType: z.string(),
    neighborhood: z.string().nullable(),
    price: z.number(),
});
export const createLeadBodySchema = z.object({
    propertyId: z.string().min(1, "O ID do imóvel é obrigatório"),
    clientName: z.string().trim().min(1, "O nome é obrigatório"),
    clientPhone: z.string().trim().min(1, "O telefone é obrigatório"),
    origin: z.enum(["CHAT_IA", "SITE_FORM", "WHATSAPP"]).default("SITE_FORM"),
    aiSummary: z.string().optional(),
});
export const errorResponseSchema = z.object({
    error: z.string(),
    code: z.string(),
});
