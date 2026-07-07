import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class PublicUrlService {
  constructor(private readonly config: ConfigService) {}

  base(): string {
    return (this.config.get<string>('PUBLIC_BASE_URL') || 'http://localhost:8000').replace(/\/$/, '');
  }

  file(path: string): string {
    const clean = path.replace(/^\/+/, '');
    return `${this.base()}/files/${clean}`;
  }
}

export function slugify(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}
