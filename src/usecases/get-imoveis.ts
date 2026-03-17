import { NotFoundError } from "../errors/index.js";
import { prisma } from "../lib/db.js";

interface InputDto {
  id: string;
}

export class GetProperty {
  async execute({ id }: InputDto) {
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
