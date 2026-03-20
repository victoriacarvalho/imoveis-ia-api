import { z } from "zod";
import { prisma } from "../lib/db.js";
const propertyBodySchema = z.object({
    userId: z.string().min(1),
    title: z.string().min(1),
    description: z.string().min(1),
    neighborhood: z.string().min(1),
    city: z.string().min(1),
    state: z.string().min(1),
    agencyId: z.string().min(1),
    propertyType: z.string().min(1),
    transactionType: z.string().min(1),
    price: z.number().nonnegative(),
    bedrooms: z.number().int().nonnegative(),
    bathrooms: z.number().int().nonnegative(),
    parkingSpots: z.number().int().nonnegative().optional(),
    mainImage: z.string().url(),
    gallery: z.array(z.string().url()).default([]),
    status: z.enum(["DISPONIVEL", "ALUGADO", "VENDIDO"]).optional(),
});
async function ensureAdmin(userId) {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, isAdmin: true },
    });
    return Boolean(user?.isAdmin);
}
export async function adminPropertiesRoutes(app) {
    app.get("/admin/properties", async (request, reply) => {
        const querySchema = z.object({
            userId: z.string().min(1),
        });
        const parsed = querySchema.safeParse(request.query);
        if (!parsed.success) {
            return reply.status(400).send({ message: "userId é obrigatório" });
        }
        const { userId } = parsed.data;
        const isAdmin = await ensureAdmin(userId);
        if (!isAdmin) {
            return reply.status(403).send({ message: "Acesso negado" });
        }
        const properties = await prisma.property.findMany({
            orderBy: { title: "asc" },
        });
        return reply.send(properties);
    });
    app.get("/admin/properties/:id", async (request, reply) => {
        const paramsSchema = z.object({
            id: z.string().min(1),
        });
        const querySchema = z.object({
            userId: z.string().min(1),
        });
        const parsedParams = paramsSchema.safeParse(request.params);
        const parsedQuery = querySchema.safeParse(request.query);
        if (!parsedParams.success || !parsedQuery.success) {
            return reply.status(400).send({ message: "Dados inválidos" });
        }
        const { id } = parsedParams.data;
        const { userId } = parsedQuery.data;
        const isAdmin = await ensureAdmin(userId);
        if (!isAdmin) {
            return reply.status(403).send({ message: "Acesso negado" });
        }
        const property = await prisma.property.findUnique({
            where: { id },
        });
        if (!property) {
            return reply.status(404).send({ message: "Imóvel não encontrado" });
        }
        return reply.send(property);
    });
    app.post("/admin/properties", async (request, reply) => {
        const parsed = propertyBodySchema.safeParse(request.body);
        if (!parsed.success) {
            return reply.status(400).send({
                message: "Dados inválidos",
                errors: parsed.error.flatten(),
            });
        }
        // AQUI: Deixamos a desestruturação normal
        const { userId, title, description, neighborhood, city, state, agencyId, propertyType, transactionType, price, bedrooms, bathrooms, parkingSpots, mainImage, gallery, status, } = parsed.data;
        const isAdmin = await ensureAdmin(userId);
        if (!isAdmin) {
            return reply.status(403).send({
                message: "Sem permissão para cadastrar imóveis",
            });
        }
        const property = await prisma.property.create({
            data: {
                title,
                description,
                neighborhood,
                city,
                state,
                // AQUI: É aqui que o casting "as PropertyType" e "as TransactionType" devem ficar
                propertyType: propertyType,
                transactionType: transactionType,
                price,
                bedrooms,
                bathrooms,
                parkingSpots: parkingSpots ?? 0,
                mainImage,
                gallery,
                status: status ?? "DISPONIVEL",
                agency: {
                    connect: {
                        id: agencyId,
                    },
                },
            },
        });
        return reply.status(201).send(property);
    });
    app.put("/admin/properties/:id", async (request, reply) => {
        const paramsSchema = z.object({
            id: z.string().min(1),
        });
        const parsedParams = paramsSchema.safeParse(request.params);
        const parsedBody = propertyBodySchema.safeParse(request.body);
        if (!parsedParams.success || !parsedBody.success) {
            return reply.status(400).send({
                message: "Dados inválidos",
            });
        }
        // AQUI: Deixamos a desestruturação normal
        const { id } = parsedParams.data;
        const { userId, title, description, neighborhood, city, state, agencyId, propertyType, transactionType, price, bedrooms, bathrooms, parkingSpots, mainImage, gallery, status, } = parsedBody.data;
        const isAdmin = await ensureAdmin(userId);
        if (!isAdmin) {
            return reply.status(403).send({ message: "Acesso negado" });
        }
        const property = await prisma.property.update({
            where: { id },
            data: {
                title,
                description,
                neighborhood,
                city,
                state,
                propertyType: propertyType,
                transactionType: transactionType,
                price,
                bedrooms,
                bathrooms,
                parkingSpots: parkingSpots ?? 0,
                mainImage,
                gallery,
                status: status ?? "DISPONIVEL",
                agency: {
                    connect: {
                        id: agencyId,
                    },
                },
            },
        });
        return reply.send(property);
    });
    app.patch("/admin/properties/:id/toggle-active", async (request, reply) => {
        const paramsSchema = z.object({
            id: z.string().min(1),
        });
        const bodySchema = z.object({
            userId: z.string().min(1),
        });
        const parsedParams = paramsSchema.safeParse(request.params);
        const parsedBody = bodySchema.safeParse(request.body);
        if (!parsedParams.success || !parsedBody.success) {
            return reply.status(400).send({ message: "Dados inválidos" });
        }
        const { id } = parsedParams.data;
        const { userId } = parsedBody.data;
        const isAdmin = await ensureAdmin(userId);
        if (!isAdmin) {
            return reply.status(403).send({ message: "Acesso negado" });
        }
        const current = await prisma.property.findUnique({
            where: { id },
            select: { id: true, status: true },
        });
        if (!current) {
            return reply.status(404).send({ message: "Imóvel não encontrado" });
        }
        const updated = await prisma.property.update({
            where: { id },
            data: {
                status: current.status === "DISPONIVEL" ? "ALUGADO" : "VENDIDO",
            },
        });
        return reply.send(updated);
    });
    app.delete("/admin/properties/:id", async (request, reply) => {
        const paramsSchema = z.object({
            id: z.string().min(1),
        });
        const querySchema = z.object({
            userId: z.string().min(1),
        });
        const parsedParams = paramsSchema.safeParse(request.params);
        const parsedQuery = querySchema.safeParse(request.query);
        if (!parsedParams.success || !parsedQuery.success) {
            return reply.status(400).send({ message: "Dados inválidos" });
        }
        const { id } = parsedParams.data;
        const { userId } = parsedQuery.data;
        const isAdmin = await ensureAdmin(userId);
        if (!isAdmin) {
            return reply.status(403).send({ message: "Acesso negado" });
        }
        await prisma.property.delete({
            where: { id },
        });
        return reply.status(204).send();
    });
}
