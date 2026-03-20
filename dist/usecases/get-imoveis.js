import { NotFoundError } from "../errors/index.js";
import { prisma } from "../lib/db.js";
export class GetProperty {
    async execute({ id }) {
        const property = await prisma.property.findUnique({
            where: { id },
            include: {
                agency: {
                    select: { name: true, id: true },
                },
            },
        });
        if (!property) {
            throw new NotFoundError("Imóvel não encontrado.");
        }
        return property;
    }
}
