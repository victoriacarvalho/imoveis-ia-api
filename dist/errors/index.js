export class NotFoundError extends Error {
    constructor(message) {
        super(message);
        this.name = "NotFoundError";
    }
}
export class UnauthorizedError extends Error {
    constructor(message) {
        super(message);
        this.name = "UnauthorizedError";
    }
}
export class PropertyNotAvailableError extends Error {
    constructor(message) {
        super(message);
        this.name = "PropertyNotAvailableError";
    }
}
