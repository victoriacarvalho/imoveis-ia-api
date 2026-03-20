import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";

import { prisma } from "../lib/db.js";

export const profileRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    "/profile/:userId",
    {
      schema: {
        tags: ["Profile"],
        summary: "Buscar perfil do usuário",
        params: z.object({
          userId: z.string(),
        }),
      },
    },
    async (request, reply) => {
      const { userId } = request.params;

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
          plan: true,
          bedrooms: true,
          parkingSpots: true,
          bathrooms: true,
          neighborhood: true,
          onboardingDone: true,
          isAdmin: true,
        },
      });

      return reply.send(user);
    },
  );

  app.post(
    "/profile/sync",
    {
      schema: {
        tags: ["Profile"],
        summary: "Criar ou sincronizar usuário autenticado",
        body: z.object({
          userId: z.string(),
          email: z.string().email(),
          name: z.string().nullable().optional(),
          image: z.string().nullable().optional(),
        }),
      },
    },
    async (request, reply) => {
      const { userId, email, name, image } = request.body;

      const existingUser = await prisma.user.findUnique({
        where: { id: userId },
        select: { isAdmin: true },
      });

      const user = await prisma.user.upsert({
        where: { id: userId },
        update: {
          email,
          ...(name !== undefined ? { name } : {}),
          ...(image !== undefined ? { image } : {}),
        },
        create: {
          id: userId,
          email,
          emailVerified: false,
          image: image ?? null,
          isAdmin: existingUser?.isAdmin ?? false,
          name: name ?? null,
          onboardingDone: false,
        },
        select: {
          id: true,
          email: true,
          name: true,
          image: true,
          isAdmin: true,
          onboardingDone: true,
        },
      });

      return reply.send(user);
    },
  );

  app.post(
    "/profile/onboarding",
    {
      schema: {
        tags: ["Profile"],
        summary: "Salvar onboarding do usuário",
        body: z.object({
          userId: z.string(),
          name: z.string().optional(),
          plan: z.string().optional(),
          bedrooms: z.number().optional(),
          parkingSpots: z.number().optional(),
          bathrooms: z.number().optional(),
          neighborhood: z.string().optional(),
          onboardingDone: z.boolean().optional(),
        }),
      },
    },
    async (request, reply) => {
      const {
        userId,
        name,
        plan,
        bedrooms,
        parkingSpots,
        bathrooms,
        neighborhood,
        onboardingDone,
      } = request.body;

      const existingUser = await prisma.user.findUnique({
        where: { id: userId },
      });

      if (!existingUser) {
        return reply.status(404).send({
          message:
            "Usuário não encontrado. Sincronize o usuário antes do onboarding.",
        });
      }

      const user = await prisma.user.update({
        where: { id: userId },
        data: {
          ...(name !== undefined ? { name } : {}),
          ...(plan !== undefined ? { plan } : {}),
          ...(bedrooms !== undefined ? { bedrooms } : {}),
          ...(parkingSpots !== undefined ? { parkingSpots } : {}),
          ...(bathrooms !== undefined ? { bathrooms } : {}),
          ...(neighborhood !== undefined ? { neighborhood } : {}),
          ...(onboardingDone !== undefined ? { onboardingDone } : {}),
        },
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
          plan: true,
          bedrooms: true,
          parkingSpots: true,
          bathrooms: true,
          neighborhood: true,
          onboardingDone: true,
          isAdmin: true,
        },
      });

      return reply.send(user);
    },
  );
};
