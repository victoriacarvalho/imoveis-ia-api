import { z } from "zod";
import { prisma } from "../lib/db.js";
export async function interestsRoutes(app) {
    app.post("/interests", async (request, reply) => {
        const bodySchema = z.object({
            userId: z.string().min(1),
            propertyId: z.string().min(1),
        });
        const { userId, propertyId } = bodySchema.parse(request.body);
        const propertyExists = await prisma.property.findUnique({
            where: { id: propertyId },
            select: { id: true },
        });
        if (!propertyExists) {
            return reply.status(404).send({
                message: "Imóvel não encontrado",
            });
        }
        const interest = await prisma.interest.create({
            data: {
                userId,
                propertyId,
            },
        });
        return reply.status(201).send({
            message: "Interesse registrado com sucesso",
            interest,
        });
    });
    app.get("/interests/property/:propertyId", async (request, reply) => {
        const paramsSchema = z.object({
            propertyId: z.string().min(1),
        });
        const { propertyId } = paramsSchema.parse(request.params);
        const interests = await prisma.interest.findMany({
            where: { propertyId },
            orderBy: { createdAt: "desc" },
        });
        return reply.send({
            total: interests.length,
            interests,
        });
    });
    app.get("/interests/stats/top-properties", async (_request, reply) => {
        const grouped = await prisma.interest.groupBy({
            by: ["propertyId"],
            _count: {
                propertyId: true,
            },
            orderBy: {
                _count: {
                    propertyId: "desc",
                },
            },
            take: 10,
        });
        const propertyIds = grouped.map((item) => item.propertyId);
        const properties = await prisma.property.findMany({
            where: {
                id: { in: propertyIds },
            },
            select: {
                id: true,
                title: true,
                neighborhood: true,
                city: true,
                price: true,
                mainImage: true,
            },
        });
        const result = grouped.map((item) => {
            const property = properties.find((p) => p.id === item.propertyId);
            return {
                propertyId: item.propertyId,
                totalInterests: item._count.propertyId,
                property,
            };
        });
        return reply.send(result);
    });
}
