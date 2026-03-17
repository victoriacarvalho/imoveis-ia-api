import { groq } from "@ai-sdk/groq";
import { streamText, tool } from "ai";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";

// Importamos os enums diretamente do que o Prisma gerou para você
import { PropertyType, TransactionType } from "../generated/prisma/index.js";
import { prisma } from "../lib/db.js";

export const aiRoutes: FastifyPluginAsyncZod = async (app) => {
  app.route({
    method: "POST",
    url: "/ai/chat",
    schema: {
      tags: ["AI"],
      summary: "Chatbot de atendimento imobiliário",
      body: z.object({
        messages: z.array(
          z.object({
            role: z.enum(["user", "assistant", "system", "data", "tool"]),
            content: z.string(),
          }),
        ),
      }),
    },
    handler: async (request, reply) => {
      const { messages } = request.body;

      const result = streamText({
        model: groq("openai/gpt-oss-120b"),
        maxSteps: 5,
        system: `Você é a assistente da imobiliária Casa São José. 
        Sua função é buscar imóveis baseando-se estritamente no que o usuário pedir.
        
        REGRAS:
        1. Se o usuário mencionar um local, tipo ou preço, use a ferramenta 'buscarImoveis'.
        2. Não invente dados. Se a ferramenta não retornar nada, diga que não encontrou.
        3. Identifique se o interesse é VENDA ou ALUGUEL.`,

        messages,
        tools: {
          buscarImoveis: tool({
            description:
              "Busca imóveis no banco de dados usando os termos digitados pelo usuário.",
            // ✅ MAPEAMENTO COMPLETO: Declaramos todos os campos que deram erro anteriormente
            parameters: z.object({
              termoBusca: z
                .string()
                .optional()
                .describe("Termo geral (ex: casa, apartamento)"),
              tipo: z.string().optional().describe("O tipo do imóvel"),
              localizacao: z.string().optional().describe("Cidade ou bairro"),
              cidade: z.string().optional(),
              bairro: z.string().optional(),
              preco: z.number().optional(),
              precoMaximo: z.number().optional(),
              tipo_transacao: z.string().optional(),
            }),

            execute: async (args) => {
              // 1. Normalização dos filtros (unificamos o que a IA mandar)
              const pesquisaGeral = args.termoBusca || args.tipo || "";
              const localFiltro =
                args.localizacao || args.cidade || args.bairro || "";
              const valorFiltro = args.precoMaximo || args.preco;

              // 2. Mapeamento de Enums do seu Schema
              let transacaoFiltro = undefined;
              if (args.tipo_transacao?.toUpperCase().includes("VENDA"))
                transacaoFiltro = TransactionType.VENDA;
              if (args.tipo_transacao?.toUpperCase().includes("ALU"))
                transacaoFiltro = TransactionType.ALUGUEL;

              // 3. Busca no Prisma usando os campos do seu schema.prisma
              const properties = await prisma.property.findMany({
                where: {
                  status: "DISPONIVEL",
                  transactionType: transacaoFiltro,
                  price: valorFiltro ? { lte: valorFiltro } : undefined,
                  // ✅ BUSCA FLEXÍVEL: O que o user digitou é buscado em vários campos
                  OR:
                    pesquisaGeral || localFiltro
                      ? [
                          {
                            title: {
                              contains: pesquisaGeral,
                              mode: "insensitive",
                            },
                          },
                          {
                            city: {
                              contains: localFiltro,
                              mode: "insensitive",
                            },
                          },
                          {
                            neighborhood: {
                              contains: localFiltro,
                              mode: "insensitive",
                            },
                          },
                          {
                            description: {
                              contains: pesquisaGeral,
                              mode: "insensitive",
                            },
                          },
                        ]
                      : undefined,
                },
                take: 4,
                select: {
                  id: true,
                  title: true,
                  price: true,
                  neighborhood: true,
                  city: true,
                  mainImage: true,
                },
              });

              return properties;
            },
          }),
        },
      });

      // Padrão de resposta do repositório bootcamp-treinos
      const response = result.toUIMessageStreamResponse();

      reply.status(response.status);
      response.headers.forEach((value, key) => reply.header(key, value));

      return reply.send(response.body);
    },
  });
};
