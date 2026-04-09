import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';

import type { RequestUser } from '../interfaces/request-user.interface';

@Injectable()
export class OrgGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context
      .switchToHttp()
      .getRequest<{ user: RequestUser; organizationId?: string }>();

    if (!request.user?.organizationId) {
      throw new ForbiddenException({ code: 'ORG_MISMATCH', message: 'Organization not identified' });
    }

    // Promote organizationId to the top-level request object for convenient access in controllers
    request.organizationId = request.user.organizationId;
    return true;
  }
}
