declare namespace Express {
  interface Locals {
    user?: {
      _id?: string;
      properties?: { _id?: string };
    };
  }
}
