import { prisma } from "../lib/db.js";
export class CreateLead {
    async execute(data) {
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
