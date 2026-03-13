import { prisma } from "../lib/db.js";

interface ListPropertiesRequest {
  city?: string;
  type?: "APARTAMENTO" | "CASA" | "COMERCIAL" | "LOTE" | "REPUBLICA" | "QUARTO";
  maxPrice?: number;
}

export class ListProperties {
  async execute(filters: ListPropertiesRequest) {
    const properties = await prisma.property.findMany({
      where: {
        status: "DISPONIVEL",
        ...(filters.city && { city: filters.city }),
        ...(filters.type && { propertyType: filters.type }),
        ...(filters.maxPrice && { price: { lte: filters.maxPrice } }),
      },
      include: {
        agency: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    // Converte o Decimal do Prisma para Number nativo do JS/JSON
    return properties.map((prop) => ({
      ...prop,
      price: Number(prop.price),
      area: prop.area ? Number(prop.area) : null,
    }));
  }
}
