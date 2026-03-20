import { z } from "zod";
import { prisma } from "../lib/db.js";
export async function profilePreferencesRoutes(app) {
    app.patch("/profile/preferences", async (request, reply) => {
        const bodySchema = z.object({
            userId: z.string().min(1),
            plan: z.string().optional(),
            bedrooms: z.number().int().nullable().optional(),
            parkingSpots: z.number().int().nullable().optional(),
            bathrooms: z.number().int().nullable().optional(),
            neighborhood: z.string().nullable().optional(),
            transactionType: z.string().nullable().optional(),
            propertyType: z.string().nullable().optional(),
            maxPrice: z.number().nullable().optional(),
        });
        const parsed = bodySchema.safeParse(request.body);
        if (!parsed.success) {
            return reply.status(400).send({
                message: "Dados inválidos",
                errors: parsed.error.flatten(),
            });
        }
        const { userId, plan, bedrooms, parkingSpots, bathrooms, neighborhood, transactionType, propertyType, maxPrice, } = parsed.data;
        const profile = await prisma.user.update({
            where: {
                id: userId,
            },
            data: {
                ...(plan !== undefined ? { plan } : {}),
                ...(bedrooms !== undefined ? { bedrooms } : {}),
                ...(parkingSpots !== undefined ? { parkingSpots } : {}),
                ...(bathrooms !== undefined ? { bathrooms } : {}),
                ...(neighborhood !== undefined ? { neighborhood } : {}),
                ...(transactionType !== undefined ? { transactionType } : {}),
                ...(propertyType !== undefined ? { propertyType } : {}),
                ...(maxPrice !== undefined ? { maxPrice } : {}),
            },
        });
        return reply.send(profile);
    });
}
