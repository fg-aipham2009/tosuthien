import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';

type JwtPayload = {
  sub: string;
  username: string;
};

/**
 * GET/HEAD/OPTIONS luôn public.
 * Một số POST/PUT public (chat, reading progress, favorites).
 * Còn lại create/update/delete bắt buộc Bearer JWT.
 */
@Injectable()
export class AdminWriteGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const method = (req.method || 'GET').toUpperCase();
    const path = (req.path || req.url.split('?')[0] || '').replace(/\/+$/, '') || '/';

    const protectedGet =
      path === '/api/auth/me' || path === '/api/auth/users';

    if (
      (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') &&
      !protectedGet
    ) {
      return true;
    }

    if (this.isPublicWrite(method, path)) {
      return true;
    }

    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
    if (!token) {
      throw new UnauthorizedException('Cần đăng nhập admin');
    }

    try {
      const secret =
        this.config.get<string>('JWT_SECRET') || 'tosuthien-dev-jwt-secret';
      const payload = this.jwt.verify<JwtPayload>(token, { secret });
      (req as Request & { admin?: JwtPayload }).admin = payload;
      return true;
    } catch {
      throw new UnauthorizedException('Token không hợp lệ hoặc đã hết hạn');
    }
  }

  private isPublicWrite(method: string, path: string): boolean {
    if (method === 'POST' && path === '/api/auth/login') return true;
    if (method === 'POST' && path.startsWith('/api/rag/')) return true;
    if (method === 'PUT' && path === '/api/reading-progress') return true;
    if (method === 'POST' && path === '/api/mp3/favorites/toggle') return true;
    return false;
  }
}
