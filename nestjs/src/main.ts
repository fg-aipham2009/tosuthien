import cluster from 'node:cluster';
import os from 'node:os';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

Object.defineProperty(BigInt.prototype, 'toJSON', {
  value(this: bigint) {
    return this.toString();
  },
  configurable: true,
});

/**
 * Use both VPS cores for concurrent chat/API requests.
 * Cap at 2 by default so Postgres + embed_server still have headroom on a 2-core box.
 */
function workerCount(): number {
  const raw = process.env.WEB_CONCURRENCY?.trim();
  if (raw) {
    const n = Number(raw);
    if (Number.isFinite(n) && n >= 1) return Math.min(Math.floor(n), 4);
  }
  return Math.min(Math.max(os.cpus().length, 1), 2);
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.enableCors();
  const port = process.env.PORT || 8000;
  await app.listen(port);
  // Long-lived SSE chat streams — avoid premature socket kills under load.
  const server = app.getHttpServer();
  server.keepAliveTimeout = 125_000;
  server.headersTimeout = 130_000;
  server.requestTimeout = 0;
  server.timeout = 0;
  console.log(
    `API http://localhost:${port}/api/health (pid=${process.pid} worker=${!cluster.isPrimary})`,
  );
}

function start(): void {
  const workers = workerCount();
  if (cluster.isPrimary && workers > 1) {
    console.log(`Primary ${process.pid}: forking ${workers} API workers`);
    for (let i = 0; i < workers; i++) cluster.fork();
    cluster.on('exit', (worker, code, signal) => {
      console.warn(
        `Worker ${worker.process.pid} exited (code=${code} signal=${signal}); restarting`,
      );
      cluster.fork();
    });
    return;
  }
  void bootstrap();
}

start();
