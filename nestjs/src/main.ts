import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

Object.defineProperty(BigInt.prototype, 'toJSON', {
  value(this: bigint) {
    return this.toString();
  },
  configurable: true,
});

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
  console.log(`API http://localhost:${port}/api/health`);
}

bootstrap();
