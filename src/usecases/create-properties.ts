import { NotFoundError } from "../errors/index.js";
import { prisma } from "../lib/db.js";

interface InputDto {
  title: string;
  description?: string;
  transactionType: "VENDA" | "ALUGUEL";
  propertyType:
    | "APARTAMENTO"
    | "CASA"
    | "COMERCIAL"
    | "LOTE"
    | "REPUBLICA"
    | "QUARTO";
  price: number;
  city: string;
  state: string;
  neighborhood?: string;
  bedrooms?: number;
  bathrooms?: number;
  mainImage: string;
  agencyId: string;
}

interface OutputDto {
  id: string;
  title: string;
  propertyType: string;
  transactionType: string;
  price: number;
  city: string;
  state: string;
  status: string;
}

export class CreateProperty {
  async execute(dto: InputDto): Promise<OutputDto> {
    const agencyExists = await prisma.agency.findUnique({
      where: { id: dto.agencyId },
    });

    if (!agencyExists) {
      throw new NotFoundError("Agência/Imobiliária não encontrada no sistema.");
    }

    const property = await prisma.property.create({
      data: {
        title: dto.title,
        description: dto.description,
        transactionType: dto.transactionType,
        propertyType: dto.propertyType,
        price: dto.price,
        city: dto.city,
        state: dto.state,
        neighborhood: dto.neighborhood,
        bedrooms: dto.bedrooms ?? 0,
        bathrooms: dto.bathrooms ?? 0,
        mainImage: dto.mainImage,
        agencyId: dto.agencyId,
        status: "DISPONIVEL",
      },
    });

    return {
      id: property.id,
      title: property.title,
      propertyType: property.propertyType,
      transactionType: property.transactionType,
      price: Number(property.price),
      city: property.city,
      state: property.state,
      status: property.status,
    };
  }
}
