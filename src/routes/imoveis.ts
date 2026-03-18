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
  // 1. Cliente ver detalhes de UMA propriedade
  app.withTypeProvider<ZodTypeProvider>().route({
    method: "GET",
    url: "/:id", // ✅ Se houver prefixo no index.ts. Se não houver, mantenha "/imoveis/:id"
    schema: {
      tags: ["Imóveis"],
      summary: "Busca os detalhes completos de um imóvel",
      params: z.object({
        id: z.string(), // ✅ Removemos o .cuid() para permitir o externalId
      }),
      response: {
        200: z.any(),
        404: z.object({ error: z.string(), code: z.string() }),
      },
    },
    handler: async (request, reply) => {
      try {
        const getProperty = new GetProperty();
        // O seu useCase (GetProperty) precisa estar preparado para buscar por externalId também!
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

  // 2. ROTA RECONSTRUÍDA: Cliente ver TODAS as propriedades
  app.withTypeProvider<ZodTypeProvider>().route({
    method: "GET",
    url: "/",
    schema: {
      tags: ["Imóveis"],
      summary: "Lista todos os imóveis cadastrados",
      response: {
        200: z.any(), // Depois você pode tipar isso melhor com Zod
      },
    },
    handler: async (request, reply) => {
      // ⚠️ ATENÇÃO: Você precisa buscar as 'propriedades' no banco de dados aqui.
      // Exemplo usando Prisma diretamente (ou você pode criar um UseCase de Listagem):
      const propriedades = await prisma.property.findMany();

      const imoveisFormatados = propriedades.map((imovel: any) => ({
        id: imovel.id,
        title: imovel.title,
        propertyType: imovel.propertyType,
        neighborhood: imovel.neighborhood,
        price: Number(imovel.price),
        bedrooms: imovel.bedrooms,
        bathrooms: imovel.bathrooms,
        mainImage: imovel.mainImage,
      }));

      return reply.status(200).send({ imoveis: imoveisFormatados });
    },
  });

  // 3. Admin criar novos anúncios
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

  // ⚠️ NOTA: Removi a duplicata final do "GET /imoveis/:id" que estava sobrando no seu código original,
  // pois a primeira rota do arquivo já faz exatamente a mesma coisa.
};
