import "dotenv/config";

import fastifyCors from "@fastify/cors";
import fastifySwagger from "@fastify/swagger";
import fastifyApiReference from "@scalar/fastify-api-reference";
import { fromNodeHeaders } from "better-auth/node";
import Fastify from "fastify";
import {
  jsonSchemaTransform,
  serializerCompiler,
  validatorCompiler,
  ZodTypeProvider,
} from "fastify-type-provider-zod";
import z from "zod";

import { auth } from "./lib/auth.js";
import { prisma } from "./lib/db.js";
import { CreateProperty } from "./usecases/create-properties.js";

const app = Fastify({
  logger: true,
});

app.setValidatorCompiler(validatorCompiler);
app.setSerializerCompiler(serializerCompiler);

await app.register(fastifySwagger, {
  openapi: {
    info: {
      title: "API Catálogo de Imóveis e Repúblicas",
      description: "API do agregador inteligente com IA",
      version: "1.0.0",
    },
    servers: [
      {
        description: "Localhost",
        url: "http://localhost:3000",
      },
    ],
  },
  transform: jsonSchemaTransform,
});

await app.register(fastifyCors, {
  origin: ["http://localhost:3000"],
  credentials: true,
});

await app.register(fastifyApiReference, {
  routePrefix: "/docs",
  configuration: {
    sources: [
      {
        title: "Imóveis API",
        slug: "imoveis-api",
        url: "/swagger.json",
      },
      {
        title: "Auth API",
        slug: "auth-api",
        url: "/api/auth/open-api/generate-schema",
      },
    ],
  },
});

//cliente ver as propriedades
app.withTypeProvider<ZodTypeProvider>().route({
  method: "GET",
  url: "/imoveis",
  schema: {
    tags: ["Imóveis"],
    description: "Lista o catálogo de imóveis resumido para exibição nos cards",
    response: {
      201: z.object({
        imoveis: z.array(
          z.object({
            id: z.string(),
            title: z.string(),
            propertyType: z.string(),
            neighborhood: z.string().nullable(),
            price: z.number(),
          }),
        ),
      }),
      400: z.object({
        error: z.string(),
        code: z.string(),
      }),
    },
  },
  handler: async (request, reply) => {
    const propriedades = await prisma.property.findMany({
      where: {
        status: "DISPONIVEL",
      },
      select: {
        id: true,
        title: true,
        propertyType: true,
        neighborhood: true,
        price: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    const imoveisFormatados = propriedades.map((imovel) => ({
      id: imovel.id,
      title: imovel.title,
      propertyType: imovel.propertyType,
      neighborhood: imovel.neighborhood,
      price: Number(imovel.price),
    }));

    return reply.send({ imoveis: imoveisFormatados });
  },
});

//adm criar novos anuncios
app.withTypeProvider<ZodTypeProvider>().route({
  method: "POST",
  url: "/imoveis",
  schema: {
    operationId: "createProperty",
    tags: ["Imóveis"],
    summary: "Cadastra um novo imóvel (Apenas Administradores)",
    body: z.object({
      title: z.string().trim().min(1, "O título é obrigatório"),
      description: z.string().optional(),
      transactionType: z.enum(["VENDA", "ALUGUEL"]),
      propertyType: z.enum([
        "APARTAMENTO",
        "CASA",
        "COMERCIAL",
        "LOTE",
        "REPUBLICA",
        "QUARTO",
      ]),
      price: z.number().positive("O preço deve ser maior que zero"),
      city: z.string().trim().min(1, "A cidade é obrigatória"),
      state: z.string().length(2, "Use a sigla do estado (Ex: MG)"),
      neighborhood: z.string().optional(),
      bedrooms: z.number().int().nonnegative().default(0),
      bathrooms: z.number().int().nonnegative().default(0),
      mainImage: z.string().url("A imagem principal deve ser um link válido"),
      agencyId: z.string(),
    }),
    response: {
      201: z.object({
        id: z.string(),
        title: z.string(),
        message: z.string().optional(),
      }),
      401: z.object({
        error: z.string(),
        code: z.string(),
      }),
      403: z.object({
        error: z.string(),
        code: z.string(),
      }),
      500: z.object({
        error: z.string(),
        code: z.string(),
      }),
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

app.withTypeProvider<ZodTypeProvider>().route({
  method: "GET",
  url: "/swagger.json",
  schema: {
    hide: true,
  },
  handler: async () => {
    return app.swagger();
  },
});

app.withTypeProvider<ZodTypeProvider>().route({
  method: "GET",
  url: "/",
  schema: {
    description: "Status do Servidor",
    tags: ["Health Check"],
    response: {
      200: z.object({
        message: z.string(),
      }),
    },
  },
  handler: () => {
    return {
      message: "API Imobiliária funcionando! Acesse /docs para ver o Swagger.",
    };
  },
});

app.route({
  method: ["GET", "POST"],
  url: "/api/auth/*",
  async handler(request, reply) {
    try {
      const url = new URL(request.url, `http://${request.headers.host}`);
      const headers = new Headers();
      Object.entries(request.headers).forEach(([key, value]) => {
        if (value) headers.append(key, value.toString());
      });
      const req = new Request(url.toString(), {
        method: request.method,
        headers,
        ...(request.body ? { body: JSON.stringify(request.body) } : {}),
      });
      const response = await auth.handler(req);
      reply.status(response.status);
      response.headers.forEach((value, key) => reply.header(key, value));
      reply.send(response.body ? await response.text() : null);
    } catch (error) {
      app.log.error(error);
      reply.status(500).send({
        error: "Erro interno de autenticação",
        code: "AUTH_FAILURE",
      });
    }
  },
});

try {
  await app.listen({ port: Number(process.env.PORT) || 300 });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
