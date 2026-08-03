import { Module } from '@nestjs/common';

import { IdentityResolver } from './identity.resolver';
import { IdentityService } from './identity.service';
import { PasswordService } from './password.service';
import { SessionService } from './session.service';
import { SessionTokenService } from './session-token.service';

@Module({
  providers: [
    IdentityResolver,
    IdentityService,
    PasswordService,
    SessionService,
    SessionTokenService,
  ],
  exports: [SessionService],
})
export class IdentityModule {}
