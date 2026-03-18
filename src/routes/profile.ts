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
          plan: true,
          bedrooms: true,
          parkingSpots: true,
          bathrooms: true,
          neighborhood: true,
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

      const user = existingUser
        ? await prisma.user.update({
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
              plan: true,
              bedrooms: true,
              parkingSpots: true,
              bathrooms: true,
              neighborhood: true,
              onboardingDone: true,
            },
          })
        : await prisma.user.create({
            data: {
              id: userId,
              email: `${userId}@placeholder.local`,
              emailVerified: false,
              image: null,
              isAdmin: false,
              name: name ?? null,
              plan: plan ?? null,
              bedrooms: bedrooms ?? null,
              parkingSpots: parkingSpots ?? null,
              bathrooms: bathrooms ?? null,
              neighborhood: neighborhood ?? null,
              onboardingDone: onboardingDone ?? false,
            },
            select: {
              id: true,
              name: true,
              plan: true,
              bedrooms: true,
              parkingSpots: true,
              bathrooms: true,
              neighborhood: true,
              onboardingDone: true,
            },
          });

      return reply.send(user);
    },
  );
};
