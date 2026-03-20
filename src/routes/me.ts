import { FastifyInstance } from "fastify";
import { z } from "zod";

import { prisma } from "../lib/db.js";

export async function meRoutes(app: FastifyInstance) {
  app.get("/me", async (request, reply) => {
    const querySchema = z.object({
      email: z.string().email(),
    });

    const parsed = querySchema.safeParse(request.query);

    if (!parsed.success) {
      return reply.status(400).send({ message: "email é obrigatório" });
    }

    const user = await prisma.user.findUnique({
      where: { email: parsed.data.email },
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
