import { z } from "zod";
import { prisma } from "../lib/db.js";
export async function meRoutes(app) {
    app.get("/me", async (request, reply) => {
        const querySchema = z.object({
            clerkId: z.string().min(1),
        });
        const parsed = querySchema.safeParse(request.query);
        if (!parsed.success) {
            return reply.status(400).send({ message: "clerkId é obrigatório" });
        }
        const user = await prisma.user.findUnique({
            where: { id: parsed.data.clerkId },
            select: {
                id: true,
                name: true,
                email: true,
                isAdmin: true,
            },
        });
        if (!user) {
            return reply.status(404).send({ message: "Usuário não encontrado" });
        }
        return reply.send(user);
    });
}
