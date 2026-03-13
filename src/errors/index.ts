export class ResourceNotFoundError extends Error {
  constructor() {
    super("Recurso não encontrado.");
  }
}

export class UnauthorizedError extends Error {
  constructor() {
    super("Acesso não autorizado.");
  }
}
