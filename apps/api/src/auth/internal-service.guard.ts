import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import type { Request } from "express";
import { assertServiceToken } from "./service-token";

@Injectable()
export class InternalServiceGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    assertServiceToken(context.switchToHttp().getRequest<Request>().headers.authorization);
    return true;
  }
}
