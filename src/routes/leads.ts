import { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import z from "zod";

import { createLeadBodySchema, errorResponseSchema } from "../schemas/index.js";
import { CreateLead } from "../usecases/create-lead.js";

export const leadsRoutes: FastifyPluginAsyncZod = async (app) => {
  app.route({
    method: "POST",
    url: "/",
    schema: {
      tags: ["Leads"],
      summary: "Registra o interesse de um cliente em um imóvel",
      body: createLeadBodySchema,
      response: {
        201: z.any(),
        400: errorResponseSchema,
      },
    },
    handler: async (request, reply) => {
      const createLead = new CreateLead();
      const lead = await createLead.execute(request.body);

      return reply.status(201).send(lead);
    },
  });
};
