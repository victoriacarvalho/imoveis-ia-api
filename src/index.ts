import "dotenv/config";

import fastifyCors from "@fastify/cors";
import fastifySwagger from "@fastify/swagger";
import fastifyApiReference from "@scalar/fastify-api-reference";
import Fastify from "fastify";
import {
  jsonSchemaTransform,
  serializerCompiler,
  validatorCompiler,
  ZodTypeProvider,
} from "fastify-type-provider-zod";
import z from "zod";

import { auth } from "./lib/auth.js";
import { adminRoutes } from "./routes/admin.js";
import { adminPropertiesRoutes } from "./routes/admin-properties.js";
import { aiRoutes } from "./routes/ai.js";
import { favoriteRoutes } from "./routes/favorites.js";
import { imoveisRoutes } from "./routes/imoveis.js";
import { interestsRoutes } from "./routes/interests.js";
import { leadEventsRoutes } from "./routes/leads.js";
import { meRoutes } from "./routes/me.js";
import { profileRoutes } from "./routes/profile.js";
import { profilePreferencesRoutes } from "./routes/profile-preferences.js";

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
        url: "https://imoveis-ia-api.onrender.com",
      },
    ],
  },
  transform: jsonSchemaTransform,
});

await app.register(fastifyCors, {
  origin: true,
  credentials: true,
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "User-Agent",
    "x-vercel-ai-data-stream",
    "x-vercel-ai-request-id",
  ],
  exposedHeaders: ["x-vercel-ai-data-stream"],
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
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

//Rotas
await app.register(imoveisRoutes, { prefix: "/imoveis" });
await app.register(aiRoutes);
await app.register(leadEventsRoutes);
await app.register(profileRoutes);
await app.register(favoriteRoutes);
await app.register(interestsRoutes);
await app.register(adminRoutes);
await app.register(adminPropertiesRoutes);
await app.register(profilePreferencesRoutes);
await app.register(meRoutes);

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

const PORT = Number(process.env.PORT) || 8081;
const API_URL = process.env.NEXT_PUBLIC_API_URL;

try {
  await app.listen({ port: PORT, host: "0.0.0.0" });
  console.log(`Server ready at ${API_URL}:${PORT}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
