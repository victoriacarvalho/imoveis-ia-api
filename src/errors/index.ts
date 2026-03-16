export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotFoundError";
  }
}

export class UnauthorizedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnauthorizedError";
  }
}

// Erro específico para quando alguém tentar agendar visita num imóvel que já foi alugado/vendido
export class PropertyNotAvailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PropertyNotAvailableError";
  }
}
