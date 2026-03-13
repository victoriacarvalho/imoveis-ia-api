import { prisma } from "../lib/db.js";

interface CreateLeadRequest {
  propertyId: string;
  agencyId: string;
  clientName: string;
  clientPhone: string;
  origin: "BOTAO_AGENDAR" | "CHAT_IA";
  aiSummary?: string;
}

export class CreateLead {
  async execute(data: CreateLeadRequest) {
    const lead = await prisma.lead.create({
      data: {
        propertyId: data.propertyId,
        agencyId: data.agencyId,
        clientName: data.clientName,
        clientPhone: data.clientPhone,
        origin: data.origin,
        aiSummary: data.aiSummary,
        status: "NOVO",
      },
    });

    return lead;
  }
}
