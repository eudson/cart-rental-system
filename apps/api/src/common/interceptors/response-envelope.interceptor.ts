import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { map, type Observable } from 'rxjs';

import type { ApiSuccessResponse } from '../interfaces/api-response.interface';
import { isResponseWithMeta } from './response-meta.util';

@Injectable()
export class ResponseEnvelopeInterceptor<T>
  implements NestInterceptor<T, ApiSuccessResponse<T>>
{
  intercept(
    _context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<ApiSuccessResponse<T>> {
    return next.handle().pipe(
      map((data) => {
        if (isResponseWithMeta(data)) {
          return {
            data: data.payload as T,
            meta: data.meta,
            error: null,
          };
        }

        return {
          data,
          meta: {},
          error: null,
        };
      }),
    );
  }
}
