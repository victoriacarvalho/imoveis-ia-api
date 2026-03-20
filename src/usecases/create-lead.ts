import { LeadOrigin } from "../generated/prisma/index.js";
import { prisma } from "../lib/db.js";

type CreateLeadInput = {
  clientName: string;
  clientPhone: string;
  origin: LeadOrigin;
  aiSummary?: string | null;
  propertyId: string;
};

export class CreateLead {
  async execute(data: CreateLeadInput) {
    const property = await prisma.property.findUnique({
      where: { id: data.propertyId },
      select: { agencyId: true },
    });

    if (!property) {
      throw new Error("Imóvel não encontrado");
    }

    const lead = await prisma.lead.create({
      data: {
        clientName: data.clientName,
        clientPhone: data.clientPhone,
        origin: data.origin,
        aiSummary: data.aiSummary,
        propertyId: data.propertyId,
        agencyId: property.agencyId,
      },
    });

    return lead;
  }
}
