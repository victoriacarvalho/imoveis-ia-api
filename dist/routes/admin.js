import { z } from "zod";
import { prisma } from "../lib/db.js";
export async function adminRoutes(app) {
    app.get("/admin/me", async (request, reply) => {
        const querySchema = z.object({
            userId: z.string().min(1),
        });
        const { userId } = querySchema.parse(request.query);
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                isAdmin: true,
            },
        });
        if (!user) {
            return reply.send({ isAdmin: false });
        }
        return reply.send({
            isAdmin: user.isAdmin,
        });
    });
    app.get("/admin/equipe", async (request, reply) => {
        const users = await prisma.user.findMany({
            select: {
                id: true,
                name: true,
                email: true,
                image: true,
                isAdmin: true,
                createdAt: true,
            },
            orderBy: { isAdmin: "desc" },
        });
        return reply.send(users);
    });
}
