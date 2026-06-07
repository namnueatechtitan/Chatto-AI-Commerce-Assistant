import { Injectable } from "@nestjs/common";

@Injectable()
export class HealthService {
  getHealth() {
    return {
      status: "ok",
      service: "chatto-api",
      phase: "phase-2-foundation",
      timestamp: new Date().toISOString(),
    };
  }
}
