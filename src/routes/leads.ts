import { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";

import { CreateLead } from "../usecases/CreateLead.js";

export async function leadsRoutes(app: FastifyInstance) {
  const server = app.withTypeProvider<ZodTypeProvider>();

  server.route({
    method: "POST",
    url: "/",
    schema: {
      tags: ["Leads (Contatos)"],
      description: "Registra o interesse de um cliente em um imóvel",
      body: z.object({
        propertyId: z.string(),
        agencyId: z.string(),
        clientName: z.string(),
        clientPhone: z.string(),
        origin: z.enum(["BOTAO_AGENDAR", "CHAT_IA"]),
        aiSummary: z.string().optional(),
      }),
      response: {
        201: z.object({
          message: z.string(),
        }),
      },
    },
    handler: async (request, reply) => {
      const createLead = new CreateLead();
      await createLead.execute(request.body);

      return reply.status(201).send({
        message:
          "Interesse registrado com sucesso! O responsável entrará em contato.",
      });
    },
  });
}
