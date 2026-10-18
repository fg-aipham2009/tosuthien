import {
  Injectable,
  Logger,
  OnModuleDestroy,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool, type QueryResultRow } from 'pg';

@Injectable()
export class CbetaDbService implements OnModuleDestroy {
  private readonly logger = new Logger(CbetaDbService.name);
  private pool: Pool | null = null;

  constructor(private readonly config: ConfigService) {}

  private dsn(): string {
    return (
      this.config.get<string>('CBETA_DATABASE_URL') ||
      process.env.CBETA_DATABASE_URL ||
      ''
    ).trim();
  }

  isConfigured(): boolean {
    return Boolean(this.dsn());
  }

  private getPool(): Pool {
    if (this.pool) return this.pool;
    const connectionString = this.dsn();
    if (!connectionString) {
      throw new ServiceUnavailableException(
        'CBETA_DATABASE_URL chưa cấu hình — không tra cứu được tạng CBETA',
      );
    }
    this.pool = new Pool({
      connectionString,
      max: parseInt(this.config.get<string>('CBETA_PG_POOL') || '4', 10),
      idleTimeoutMillis: 30_000,
    });
    this.pool.on('error', (err) => {
      this.logger.error(`CBETA pool error: ${err.message}`);
    });
    return this.pool;
  }

  async query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    params: unknown[] = [],
  ): Promise<T[]> {
    const res = await this.getPool().query<T>(text, params);
    return res.rows;
  }

  async onModuleDestroy() {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
    }
  }
}
