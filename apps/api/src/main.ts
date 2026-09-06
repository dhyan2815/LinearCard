import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors(); // Required for Next.js to talk to it
  await app.listen(3001);
}
bootstrap();
