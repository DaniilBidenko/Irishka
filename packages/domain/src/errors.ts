export class DomainError extends Error {
  constructor(
    message: string,
    readonly code: string,
  ) {
    super(message);
    this.name = "DomainError";
  }
}

export class ValidationError extends DomainError {
  constructor(message: string, readonly details?: unknown) {
    super(message, "VALIDATION");
    this.name = "ValidationError";
  }
}

export class NotFoundError extends DomainError {
  constructor(message: string) {
    super(message, "NOT_FOUND");
    this.name = "NotFoundError";
  }
}

export class ConflictError extends DomainError {
  constructor(
    message: string,
    readonly details?: unknown,
  ) {
    super(message, "CONFLICT");
    this.name = "ConflictError";
  }
}

export class MaintenanceError extends DomainError {
  constructor(message: string) {
    super(message, "MAINTENANCE");
    this.name = "MaintenanceError";
  }
}
