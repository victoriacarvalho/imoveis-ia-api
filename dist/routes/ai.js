import { groq } from "@ai-sdk/groq";
import { convertToModelMessages, streamText, tool } from "ai";
import { z } from "zod";
import { TransactionType } from "../generated/prisma/index.js";
import { prisma } from "../lib/db.js";
const API_URL = process.env.NEXT_PUBLIC_API_URL;
export const aiRoutes = async (app) => {
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
            const { messages } = request.body;
            const modelMessages = await convertToModelMessages(messages);
            function normalizarCidadeFixa() {
                return "João Monlevade";
            }
            function extrairUserId(messages) {
                for (let i = messages.length - 1; i >= 0; i--) {
                    const message = messages[i];
                    const metadata = message?.metadata;
                    if (metadata?.userId) {
                        return metadata.userId;
                    }
                }
                return undefined;
            }
            const userId = extrairUserId(messages);
            const result = streamText({
                model: groq("openai/gpt-oss-120b"),
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
          11. Quando o usuário expressar uma mudança de preferência pessoal relacionada à busca de imóveis, como quantidade de quartos, banheiros, vagas, bairro, tipo de transação, tipo de imóvel ou orçamento, use a ferramenta atualizarPerfilPreferencias para salvar essas informações no perfil antes de responder.
          12. Sempre que usar a ferramenta buscarImoveis, retorne os resultados para o usuário e sugira que ele clique para ver os detalhes de cada imóvel ou para ver todos os resultados da busca.
          13. Seja breve e objetivo nas respostas, focando em ajudar o usuário a encontrar o imóvel ideal.
          14. Quando usar atualizarPerfilPreferencias, confirme a alteração de forma natural e breve.
          15.Só use a ferramenta atualizarPerfilPreferencias quando o usuário tiver informado claramente o novo valor da preferência. Nunca use a ferramenta para perguntas da própria assistente, como "qual o novo bairro?".
        `,
                messages: modelMessages,
                tools: {
                    buscarImoveis: tool({
                        description: "Busca imóveis no banco de dados usando filtros estruturados.",
                        inputSchema: z.object({
                            termoBusca: z.string().optional(),
                            tipoImovel: z.string().optional(),
                            bairro: z.string().optional(),
                            localizacao: z.string().optional(),
                            precoMaximo: z.coerce.number().optional(),
                            tipo_transacao: z.enum(["VENDA", "ALUGUEL"]).optional(),
                        }),
                        execute: async (args) => {
                            const buscaTexto = (args.termoBusca ||
                                args.tipoImovel ||
                                "").trim();
                            const bairroFiltro = args.bairro?.trim();
                            const localFiltro = args.localizacao?.trim();
                            const valorFiltro = args.precoMaximo;
                            const cidadeFixa = normalizarCidadeFixa();
                            let transacaoFiltro;
                            if (args.tipo_transacao === "VENDA") {
                                transacaoFiltro = TransactionType.VENDA;
                            }
                            else if (args.tipo_transacao === "ALUGUEL") {
                                transacaoFiltro = TransactionType.ALUGUEL;
                            }
                            const where = {
                                status: "DISPONIVEL",
                                city: {
                                    equals: cidadeFixa,
                                    mode: "insensitive",
                                },
                            };
                            if (transacaoFiltro) {
                                where.transactionType = transacaoFiltro;
                            }
                            if (typeof valorFiltro === "number" &&
                                !Number.isNaN(valorFiltro)) {
                                where.price = { lte: valorFiltro };
                            }
                            if (bairroFiltro) {
                                where.neighborhood = {
                                    contains: bairroFiltro,
                                    mode: "insensitive",
                                };
                            }
                            else if (localFiltro) {
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
                            console.log("ARGS TOOL buscarImoveis:", args);
                            console.log("WHERE PRISMA buscarImoveis:", JSON.stringify(where, null, 2));
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
                    atualizarPerfilPreferencias: tool({
                        description: "Atualiza as preferências do perfil do usuário quando ele pedir mudanças como quartos, banheiros, vagas, bairro, tipo de transação, tipo de imóvel ou orçamento.",
                        inputSchema: z.object({
                            plan: z.string().optional(),
                            bedrooms: z.number().optional(),
                            parkingSpots: z.number().optional(),
                            bathrooms: z.number().optional(),
                            neighborhood: z.string().optional(),
                            transactionType: z.string().optional(),
                            propertyType: z.string().optional(),
                            maxPrice: z.number().optional(),
                        }),
                        execute: async (input) => {
                            if (!userId) {
                                throw new Error("Usuário não identificado para atualizar preferências");
                            }
                            console.log("ARGS TOOL atualizarPerfilPreferencias:", {
                                userId,
                                ...input,
                            });
                            const response = await fetch(`${API_URL}/profile/preferences`, {
                                method: "PATCH",
                                headers: {
                                    "Content-Type": "application/json",
                                },
                                body: JSON.stringify({
                                    userId,
                                    ...input,
                                }),
                            });
                            if (!response.ok) {
                                const errorText = await response.text();
                                console.error("Erro profile/preferences:", errorText);
                                throw new Error("Erro ao atualizar preferências");
                            }
                            return await response.json();
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
