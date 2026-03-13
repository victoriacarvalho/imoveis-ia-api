import { ResourceNotFoundError } from "../errors/index.js";
import { prisma } from "../lib/db.js";

export class GetProperty {
  async execute(id: string) {
    const property = await prisma.property.findUnique({
      where: { id },
      include: {
        agency: true,
      },
    });

    if (!property) {
      throw new ResourceNotFoundError();
    }

    // Converte o Decimal do Prisma para Number nativo do JS/JSON
    return {
      ...property,
      price: Number(property.price),
      area: property.area ? Number(property.area) : null,
    };
  }
}
