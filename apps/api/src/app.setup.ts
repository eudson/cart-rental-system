import type { INestApplication } from '@nestjs/common';
import { ValidationPipe } from '@nestjs/common';

import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { ResponseEnvelopeInterceptor } from './common/interceptors/response-envelope.interceptor';

const LOCAL_WEB_ORIGIN_PATTERN = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

function getConfiguredCorsOrigins(): Set<string> {
  const configuredOrigins = new Set<string>();
  const rawOrigins = process.env.CORS_ORIGINS;

  if (!rawOrigins) {
    return configuredOrigins;
  }

  for (const origin of rawOrigins.split(',')) {
    const normalizedOrigin = origin.trim();
    if (normalizedOrigin) {
      configuredOrigins.add(normalizedOrigin);
    }
  }

  return configuredOrigins;
}

function isAllowedCorsOrigin(origin: string | undefined, configuredOrigins: Set<string>): boolean {
  if (!origin) {
    return true;
  }

  if (LOCAL_WEB_ORIGIN_PATTERN.test(origin)) {
    return true;
  }

  return configuredOrigins.has(origin);
}

export function configureApp(app: INestApplication): void {
  const configuredCorsOrigins = getConfiguredCorsOrigins();

  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (error: Error | null, allow?: boolean) => void,
    ) => {
      if (isAllowedCorsOrigin(origin, configuredCorsOrigins)) {
        callback(null, true);
        return;
      }

      callback(new Error('CORS origin denied'));
    },
    credentials: true,
  });
  app.setGlobalPrefix('v1');
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new ResponseEnvelopeInterceptor());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
}
