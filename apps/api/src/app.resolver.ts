import { Query, Resolver } from '@nestjs/graphql';

@Resolver()
export class AppResolver {
  @Query(() => String, {
    description: 'API readiness probe for the foundation milestone.',
  })
  status(): string {
    return 'veilfall-api-ready';
  }
}
