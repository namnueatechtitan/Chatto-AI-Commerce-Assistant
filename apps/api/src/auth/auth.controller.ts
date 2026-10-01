import { ConflictException, Controller, Get, Header, Post, Query, Req, Res, ServiceUnavailableException } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import type { Request, Response } from "express";
import { AuthSessionService, SESSION_COOKIE, SESSION_MAX_AGE } from "./auth-session.service";
import { GoogleAuthService, GOOGLE_FLOW_COOKIE, GOOGLE_FLOW_MAX_AGE } from "./google-auth.service";
import { LineAuthService, LINE_FLOW_COOKIE, LINE_FLOW_MAX_AGE } from "./line-auth.service";
import { cookieOptions, readCookie, requireWebOrigin, webOrigin } from "./auth-http";

@ApiTags("auth")
@Controller("auth")
export class AuthController {
  constructor(
    private readonly sessions: AuthSessionService,
    private readonly google: GoogleAuthService,
    private readonly line: LineAuthService,
  ) {}

  @Get("profile")
  @Header("Cache-Control", "no-store")
  @ApiOperation({ summary: "Get the signed-in user from the session cookie" })
  profile(@Req() request: Request) {
    return this.sessions.profile(readCookie(request, SESSION_COOKIE));
  }

  @Post("logout")
  @Header("Cache-Control", "no-store")
  async logout(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    requireWebOrigin(request);
    await this.sessions.revoke(readCookie(request, SESSION_COOKIE));
    response.clearCookie(SESSION_COOKIE, cookieOptions());
    return { message: "Signed out" };
  }

  @Get("google")
  async googleStart(@Res() response: Response) {
    response.setHeader("Cache-Control", "no-store");
    
    try {
      const flow = await this.google.start();
      response.cookie(GOOGLE_FLOW_COOKIE, flow.browserToken, { ...cookieOptions(), maxAge: GOOGLE_FLOW_MAX_AGE });
      return response.redirect(flow.url);
    } catch (error) {
      return response.redirect(`${webOrigin()}/login?error=${error instanceof ServiceUnavailableException ? "google_not_configured" : "google_failed"}`);
    }
  }

  @Get("google/callback")
  async googleCallback(@Query() query: Record<string, unknown>, @Req() request: Request, @Res() response: Response) {
    response.setHeader("Cache-Control", "no-store");
    response.setHeader("Referrer-Policy", "no-referrer");
    response.clearCookie(GOOGLE_FLOW_COOKIE, cookieOptions());
    const state = typeof query.state === "string" ? query.state : undefined;
    const code = typeof query.code === "string" ? query.code : undefined;
    const providerError = typeof query.error === "string" ? query.error : undefined;
    try {
      const user = await this.google.complete(state, readCookie(request, GOOGLE_FLOW_COOKIE), code, providerError);
      await this.setSession(user.id, request, response);
      return response.redirect(`${webOrigin()}/merchants`);
    } catch (error) {
      const reason = error instanceof ConflictException ? "account_exists"
        : providerError === "access_denied" ? "google_cancelled" : "google_failed";
      return response.redirect(`${webOrigin()}/login?error=${reason}`);
    }
  }

  @Get("line")
  async lineStart(@Res() response: Response) {
    response.setHeader("Cache-Control", "no-store");
    try {
      const flow = await this.line.start();
      response.cookie(LINE_FLOW_COOKIE, flow.browserToken, { ...cookieOptions(), maxAge: LINE_FLOW_MAX_AGE });
      return response.redirect(flow.url);
    } catch (error) {
      const reason = error instanceof ServiceUnavailableException ? "line_not_configured" : "line_failed";
      return response.redirect(`${webOrigin()}/login?error=${reason}`);
    }
  }

  @Get("line/callback")
  async lineCallback(@Query() query: Record<string, unknown>, @Req() request: Request, @Res() response: Response) {
    response.setHeader("Cache-Control", "no-store");
    response.setHeader("Referrer-Policy", "no-referrer");
    response.clearCookie(LINE_FLOW_COOKIE, cookieOptions());
    const state = typeof query.state === "string" ? query.state : undefined;
    const code = typeof query.code === "string" ? query.code : undefined;
    const providerError = typeof query.error === "string" ? query.error : undefined;
    try {
      const user = await this.line.complete(state, readCookie(request, LINE_FLOW_COOKIE), code, providerError);
      await this.setSession(user.id, request, response);
      return response.redirect(`${webOrigin()}/merchants`);
    } catch {
      const reason = providerError === "access_denied" ? "line_cancelled" : "line_failed";
      return response.redirect(`${webOrigin()}/login?error=${reason}`);
    }
  }

  private async setSession(userId: string, request: Request, response: Response): Promise<void> {
    const token = await this.sessions.create(userId, readCookie(request, SESSION_COOKIE));
    response.cookie(SESSION_COOKIE, token, { ...cookieOptions(), maxAge: SESSION_MAX_AGE });
  }
}

