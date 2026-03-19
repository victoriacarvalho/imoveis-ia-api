import { FastifyInstance } from "fastify";
import { z } from "zod";

import { prisma } from "../lib/db.js";

export async function leadEventsRoutes(app: FastifyInstance) {
  app.post("/lead-events", async (request, reply) => {
    const bodySchema = z.object({
      userId: z.string().min(1),
      userName: z.string().optional(),
      userEmail: z.string().email().optional(),
      propertyId: z.string().min(1),
      eventType: z.enum(["interest_click", "whatsapp_click"]),
    });

    const { userId, userName, userEmail, propertyId, eventType } =
      bodySchema.parse(request.body);

    const property = await prisma.property.findUnique({
      where: { id: propertyId },
      select: { id: true },
    });

    if (!property) {
      return reply.status(404).send({
        message: "Imóvel não encontrado",
      });
    }

    const event = await prisma.leadEvent.create({
      data: {
        userId,
        userName,
        userEmail,
        propertyId,
        eventType,
      },
    });

    return reply.status(201).send({
      message: "Evento registrado com sucesso",
      event,
    });
  });

  app.get("/admin/lead-events/top-properties", async (_request, reply) => {
    const properties = await prisma.property.findMany({
      select: {
        id: true,
        title: true,
        neighborhood: true,
        city: true,
        price: true,
        mainImage: true,
        leadEvents: {
          select: {
            eventType: true,
            userId: true,
            createdAt: true,
          },
        },
      },
    });

    const result = properties
      .map((property) => {
        const interestClicks = property.leadEvents.filter(
          (event) => event.eventType === "interest_click",
        );

        const whatsappClicks = property.leadEvents.filter(
          (event) => event.eventType === "whatsapp_click",
        );

        const uniqueInterestedUsers = new Set(
          interestClicks.map((event) => event.userId),
        ).size;

        const uniqueWhatsappUsers = new Set(
          whatsappClicks.map((event) => event.userId),
        ).size;

        const conversionRate =
          interestClicks.length > 0
            ? Number(
                ((whatsappClicks.length / interestClicks.length) * 100).toFixed(
                  1,
                ),
              )
            : 0;

        return {
          id: property.id,
          title: property.title,
          neighborhood: property.neighborhood,
          city: property.city,
          price: property.price,
          mainImage: property.mainImage,
          interestClicks: interestClicks.length,
          whatsappClicks: whatsappClicks.length,
          uniqueInterestedUsers,
          uniqueWhatsappUsers,
          conversionRate,
        };
      })
      .sort((a, b) => b.interestClicks - a.interestClicks);

    return reply.send(result);
  });

  app.get(
    "/admin/lead-events/property/:propertyId/users",
    async (request, reply) => {
      const paramsSchema = z.object({
        propertyId: z.string().min(1),
      });

      const { propertyId } = paramsSchema.parse(request.params);

      const property = await prisma.property.findUnique({
        where: { id: propertyId },
        select: {
          id: true,
          title: true,
          neighborhood: true,
          city: true,
        },
      });

      if (!property) {
        return reply.status(404).send({
          message: "Imóvel não encontrado",
        });
      }

      const events = await prisma.leadEvent.findMany({
        where: { propertyId },
        orderBy: { createdAt: "desc" },
        select: {
          userId: true,
          userName: true,
          userEmail: true,
          eventType: true,
          createdAt: true,
        },
      });

      const usersMap = new Map<
        string,
        {
          userId: string;
          userName: string | null;
          userEmail: string | null;
          interestClicks: number;
          whatsappClicks: number;
          lastEventAt: Date;
        }
      >();

      for (const event of events) {
        const existing = usersMap.get(event.userId);

        if (!existing) {
          usersMap.set(event.userId, {
            userId: event.userId,
            userName: event.userName ?? null,
            userEmail: event.userEmail ?? null,
            interestClicks: event.eventType === "interest_click" ? 1 : 0,
            whatsappClicks: event.eventType === "whatsapp_click" ? 1 : 0,
            lastEventAt: event.createdAt,
          });
        } else {
          existing.interestClicks +=
            event.eventType === "interest_click" ? 1 : 0;
          existing.whatsappClicks +=
            event.eventType === "whatsapp_click" ? 1 : 0;

          if (!existing.userName && event.userName) {
            existing.userName = event.userName;
          }

          if (!existing.userEmail && event.userEmail) {
            existing.userEmail = event.userEmail;
          }

          if (event.createdAt > existing.lastEventAt) {
            existing.lastEventAt = event.createdAt;
          }
        }
      }

      return reply.send({
        property,
        users: Array.from(usersMap.values()).sort(
          (a, b) => b.lastEventAt.getTime() - a.lastEventAt.getTime(),
        ),
      });
    },
  );

  app.post("/leads", async (request, reply) => {
    const bodySchema = z.object({
      clientName: z.string().min(1),
      clientPhone: z.string().min(1),
      origin: z.enum(["BOTAO_AGENDAR", "CHAT_IA"]),
      propertyId: z.string().min(1),
      agencyId: z.string().min(1),
      aiSummary: z.string().optional().nullable(),
    });

    const data = bodySchema.parse(request.body);

    const property = await prisma.property.findUnique({
      where: { id: data.propertyId },
      select: { id: true, title: true, neighborhood: true },
    });

    if (!property) {
      return reply.status(404).send({ message: "Imóvel não encontrado" });
    }

    const lead = await prisma.lead.create({
      data: {
        clientName: data.clientName,
        clientPhone: data.clientPhone,
        origin: data.origin,
        propertyId: data.propertyId,
        agencyId: data.agencyId,
        aiSummary: data.aiSummary ?? null,
        status: "NOVO",
      },
    });

    return reply.status(201).send(lead);
  });

  app.patch("/leads/:id/status", async (request, reply) => {
    const paramsSchema = z.object({
      id: z.string().min(1),
    });

    const bodySchema = z.object({
      status: z.enum(["NOVO", "ENVIADO_IMOBILIARIA", "VISITA_FEITA"]),
    });

    const { id } = paramsSchema.parse(request.params);
    const { status } = bodySchema.parse(request.body);

    const lead = await prisma.lead.findUnique({
      where: { id },
    });

    if (!lead) {
      return reply.status(404).send({ message: "Lead não encontrado" });
    }

    const updatedLead = await prisma.lead.update({
      where: { id },
      data: { status },
    });

    return reply.send(updatedLead);
  });

  app.get("/leads", async (_request, reply) => {
    const leads = await prisma.lead.findMany({
      include: {
        property: {
          select: {
            id: true,
            title: true,
            neighborhood: true,
            city: true,
            price: true,
            mainImage: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return reply.send(leads);
  });

  app.get("/admin/lead-events/summary", async (_request, reply) => {
    const allEvents = await prisma.leadEvent.findMany({
      select: {
        userId: true,
        propertyId: true,
        eventType: true,
      },
    });

    const interestClicks = allEvents.filter(
      (event) => event.eventType === "interest_click",
    ).length;

    const whatsappClicks = allEvents.filter(
      (event) => event.eventType === "whatsapp_click",
    ).length;

    const uniqueUsers = new Set(allEvents.map((event) => event.userId)).size;
    const uniqueProperties = new Set(allEvents.map((event) => event.propertyId))
      .size;

    const conversionRate =
      interestClicks > 0
        ? Number(((whatsappClicks / interestClicks) * 100).toFixed(1))
        : 0;

    return reply.send({
      totalEvents: allEvents.length,
      interestClicks,
      whatsappClicks,
      uniqueUsers,
      uniqueProperties,
      conversionRate,
    });
  });
}
