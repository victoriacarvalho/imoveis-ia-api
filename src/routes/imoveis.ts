import "dotenv/config";

import { fromNodeHeaders } from "better-auth/node";
import { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import z from "zod";

import { NotFoundError } from "../errors/index.js";
import { auth } from "../lib/auth.js";
import { prisma } from "../lib/db.js";
import {
  createPropertyBodySchema,
  errorResponseSchema,
} from "../schemas/index.js";
import { CreateProperty } from "../usecases/create-properties.js";
import { GetProperty } from "../usecases/get-imoveis.js";

export const imoveisRoutes = async (app: FastifyInstance) => {
  app.withTypeProvider<ZodTypeProvider>().route({
    method: "GET",
    url: "/:id",
    schema: {
      tags: ["Imóveis"],
      summary: "Busca os detalhes completos de um imóvel",
      params: z.object({
        id: z.string(),
      }),
      response: {
        200: z.any(),
        404: z.object({ error: z.string(), code: z.string() }),
      },
    },
    handler: async (request, reply) => {
      try {
        const getProperty = new GetProperty();
        const property = await getProperty.execute({ id: request.params.id });

        return reply.send(property);
      } catch (error) {
        if (error instanceof NotFoundError) {
          return reply
            .status(404)
            .send({ error: error.message, code: "NOT_FOUND" });
        }
        throw error;
      }
    },
  });

  app.withTypeProvider<ZodTypeProvider>().route({
    method: "GET",
    url: "/",
    schema: {
      tags: ["Imóveis"],
      summary: "Lista todos os imóveis cadastrados",
      querystring: z.object({
        propertyType: z.string().optional(),
        transactionType: z.string().optional(),
        take: z.string().optional(),
      }),
      response: {
        200: z.any(),
      },
    },
    handler: async (request, reply) => {
      const { propertyType, transactionType, take } = request.query as any;

      const propriedades = await prisma.property.findMany({
        where: {
          ...(propertyType ? { propertyType: propertyType } : {}),
          ...(transactionType ? { transactionType: transactionType } : {}),
        },
        take: take ? parseInt(take) : undefined,
      });

      const imoveisFormatados = propriedades.map((imovel: any) => ({
        id: imovel.id,
        title: imovel.title,
        propertyType: imovel.propertyType,
        neighborhood: imovel.neighborhood,
        price: Number(imovel.price),
        bedrooms: imovel.bedrooms,
        bathrooms: imovel.bathrooms,
        mainImage: imovel.mainImage,
        description: imovel.description,
      }));

      return reply.status(200).send({ imoveis: imoveisFormatados });
    },
  });

  app.withTypeProvider<ZodTypeProvider>().route({
    method: "POST",
    url: "/",
    schema: {
      operationId: "createProperty",
      tags: ["Imóveis"],
      summary: "Cadastra um novo imóvel (Apenas Administradores)",
      body: createPropertyBodySchema,
      response: {
        201: z.object({
          id: z.string(),
          title: z.string(),
          message: z.string().optional(),
        }),
        401: errorResponseSchema,
        403: errorResponseSchema,
        500: errorResponseSchema,
      },
    },
    handler: async (request, reply) => {
      try {
        const session = await auth.api.getSession({
          headers: fromNodeHeaders(request.headers),
        });

        if (!session) {
          return reply.status(401).send({
            error: "Não autorizado. Faça login para continuar.",
            code: "UNAUTHORIZED",
          });
        }

        if (!session.user.isAdmin) {
          return reply.status(403).send({
            error:
              "Acesso negado. Apenas administradores podem cadastrar imóveis.",
            code: "FORBIDDEN",
          });
        }

        const createProperty = new CreateProperty();
        const result = await createProperty.execute(request.body);

        return reply.status(201).send({
          id: result.id,
          title: result.title,
          message: "Imóvel cadastrado com sucesso!",
        });
      } catch (error) {
        app.log.error(error);

        return reply.status(500).send({
          error: "Erro interno no servidor ao tentar criar o imóvel.",
          code: "INTERNAL_SERVER_ERROR",
        });
      }
    },
  });
};
