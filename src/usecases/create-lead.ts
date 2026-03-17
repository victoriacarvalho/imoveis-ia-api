import { prisma } from "../lib/db.js";
import { CreateLeadInput } from "../schemas/index.js"; // Usando o seu schema centralizado

export class CreateLead {
  async execute(data: CreateLeadInput) {
    // Busca a agência dona do imóvel para vincular o lead corretamente
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
