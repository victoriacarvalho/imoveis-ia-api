import { groq } from "@ai-sdk/groq";
import { convertToModelMessages, streamText, tool, type UIMessage } from "ai";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";

import { TransactionType } from "../generated/prisma/index.js";
import { prisma } from "../lib/db.js";

export const aiRoutes: FastifyPluginAsyncZod = async (app) => {
  app.route({
    method: "POST",
    url: "/ai/chat",
    schema: {
      tags: ["AI"],
      summary: "Chatbot de atendimento imobiliário",
      body: z.object({
        messages: z.array(z.any()),
      }),
    },
    handler: async (request, reply) => {
      const { messages } = request.body as { messages: UIMessage[] };

      const modelMessages = await convertToModelMessages(messages);

      function normalizarCidadeFixa() {
        return "João Monlevade";
      }

      const result = streamText({
        model: groq("openai/gpt-oss-120b"),
        maxSteps: 5,
        system: `
          Você é a assistente da imobiliária Casa São José.

          Sua função é buscar imóveis com base exatamente no que o usuário pedir.
          Ao usar a ferramenta buscarImoveis, use somente estes campos:
          - tipo_transacao: "ALUGUEL" ou "VENDA"
          - tipoImovel: ex. "apartamento", "casa", "lote"
          - bairro
          - localizacao
          - precoMaximo
          - termoBusca

          Regras:
          1. "alugar", "locação", "aluguel" => tipo_transacao = "ALUGUEL"
          2. "comprar", "venda" => tipo_transacao = "VENDA"
          3. Termos como Loanda, Cruzeiro Celeste, Carneirinhos, Rosário etc. devem ser tratados como bairro
          4. A cidade deve ser sempre João Monlevade
          5. Nunca inferir outra cidade
          6. "JM", "jm", "Monlevade", "monlevade", "joao monlevade", "joão monlevade" se referem à cidade fixa e não devem virar filtro de outra cidade
          7. preço máximo deve ir em "precoMaximo"
          8. tipo de imóvel deve ir em "tipoImovel"
          9. Não invente campos fora dessa lista
          10. Se não encontrar resultados, diga que não encontrou imóveis com esses filtros
          `,
        messages: modelMessages,
        tools: {
          buscarImoveis: tool({
            description:
              "Busca imóveis no banco de dados usando filtros estruturados.",
            inputSchema: z.object({
              termoBusca: z.string().optional(),
              tipoImovel: z.string().optional(),
              bairro: z.string().optional(),
              localizacao: z.string().optional(),
              precoMaximo: z.coerce.number().optional(),
              tipo_transacao: z.enum(["VENDA", "ALUGUEL"]).optional(),
            }),
            execute: async (args) => {
              const buscaTexto = (
                args.termoBusca ||
                args.tipoImovel ||
                ""
              ).trim();
              const bairroFiltro = args.bairro?.trim();
              const localFiltro = args.localizacao?.trim();
              const valorFiltro = args.precoMaximo;
              const cidadeFixa = normalizarCidadeFixa();

              let transacaoFiltro: TransactionType | undefined;

              if (args.tipo_transacao === "VENDA") {
                transacaoFiltro = TransactionType.VENDA;
              } else if (args.tipo_transacao === "ALUGUEL") {
                transacaoFiltro = TransactionType.ALUGUEL;
              }

              const where: any = {
                status: "DISPONIVEL",
                city: {
                  equals: cidadeFixa,
                  mode: "insensitive",
                },
              };

              if (transacaoFiltro) {
                where.transactionType = transacaoFiltro;
              }

              if (
                typeof valorFiltro === "number" &&
                !Number.isNaN(valorFiltro)
              ) {
                where.price = { lte: valorFiltro };
              }

              if (bairroFiltro) {
                where.neighborhood = {
                  contains: bairroFiltro,
                  mode: "insensitive",
                };
              } else if (localFiltro) {
                where.neighborhood = {
                  contains: localFiltro,
                  mode: "insensitive",
                };
              }

              if (buscaTexto) {
                where.AND = [
                  {
                    OR: [
                      {
                        title: {
                          contains: buscaTexto,
                          mode: "insensitive",
                        },
                      },
                      {
                        description: {
                          contains: buscaTexto,
                          mode: "insensitive",
                        },
                      },
                    ],
                  },
                ];
              }

              console.log("ARGS TOOL:", args);
              console.log("WHERE PRISMA:", JSON.stringify(where, null, 2));

              const properties = await prisma.property.findMany({
                where,
                take: 5,
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

      const response = result.toUIMessageStreamResponse();

      response.headers.forEach((value, key) => {
        reply.header(key, value);
      });

      return reply.send(response.body);
    },
  });
};
