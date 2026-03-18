import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";

import { prisma } from "../lib/db.js";

export const favoriteRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    "/favorites/check",
    {
      schema: {
        tags: ["Favorites"],
        summary: "Verifica se um imóvel é favorito do usuário",
        querystring: z.object({
          userId: z.string(),
          propertyId: z.string(),
        }),
      },
    },
    async (request, reply) => {
      const { userId, propertyId } = request.query;

      const favorite = await prisma.favorite.findUnique({
        where: {
          userId_propertyId: {
            userId,
            propertyId,
          },
        },
      });

      return reply.send({
        isFavorite: Boolean(favorite),
      });
    },
  );

  app.post(
    "/favorites/toggle",
    {
      schema: {
        tags: ["Favorites"],
        summary: "Adiciona ou remove um imóvel dos favoritos",
        body: z.object({
          userId: z.string(),
          propertyId: z.string(),
        }),
      },
    },
    async (request, reply) => {
      const { userId, propertyId } = request.body;

      const existing = await prisma.favorite.findUnique({
        where: {
          userId_propertyId: {
            userId,
            propertyId,
          },
        },
      });

      if (existing) {
        await prisma.favorite.delete({
          where: {
            id: existing.id,
          },
        });

        return reply.send({ isFavorite: false });
      }

      await prisma.favorite.create({
        data: {
          userId,
          propertyId,
        },
      });

      return reply.send({ isFavorite: true });
    },
  );

  app.get(
    "/favorites/:userId",
    {
      schema: {
        tags: ["Favorites"],
        summary: "Lista os imóveis favoritos do usuário",
        params: z.object({
          userId: z.string(),
        }),
      },
    },
    async (request, reply) => {
      const { userId } = request.params;

      const favorites = await prisma.favorite.findMany({
        where: { userId },
        include: {
          property: true,
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      return reply.send(favorites);
    },
  );
};
