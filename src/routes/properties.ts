import { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";

import { ResourceNotFoundError } from "../errors/index.js";
import { propertySchema, propertyTypeSchema } from "../schemas/index.js";
import { GetProperty } from "../usecases/GetProperty.js";
import { ListProperties } from "../usecases/ListProperties.js";

export async function propertiesRoutes(app: FastifyInstance) {
  const server = app.withTypeProvider<ZodTypeProvider>();

  server.route({
    method: "GET",
    url: "/",
    schema: {
      tags: ["Imóveis"],
      description: "Lista imóveis, repúblicas e vagas com filtros",
      querystring: z.object({
        city: z.string().optional(),
        type: propertyTypeSchema.optional(),
        maxPrice: z.coerce.number().optional(),
      }),
      response: {
        200: z.object({
          properties: z.array(propertySchema),
        }),
      },
    },
    handler: async (request, reply) => {
      const listProperties = new ListProperties();
      const properties = await listProperties.execute(request.query);
      return reply.send({ properties });
    },
  });

  server.route({
    method: "GET",
    url: "/:id",
    schema: {
      tags: ["Imóveis"],
      description: "Detalhes completos de um imóvel",
      params: z.object({
        id: z.string(),
      }),
      response: {
        200: z.object({
          property: propertySchema,
        }),
        404: z.object({
          error: z.string(),
        }),
      },
    },
    handler: async (request, reply) => {
      try {
        const getProperty = new GetProperty();
        const property = await getProperty.execute(request.params.id);
        return reply.send({ property });
      } catch (error) {
        if (error instanceof ResourceNotFoundError) {
          return reply.status(404).send({ error: error.message });
        }
        throw error;
      }
    },
  });
}
