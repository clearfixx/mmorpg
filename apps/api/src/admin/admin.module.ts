import { Module } from '@nestjs/common';

import { IdentityModule } from '../identity/identity.module';
import { AdminAccessService } from './admin-access.service';
import { AdminResolver } from './admin.resolver';
import { AdminService } from './admin.service';

@Module({
  imports: [IdentityModule],
  providers: [AdminAccessService, AdminResolver, AdminService],
})
export class AdminModule {}
