import { CanActivate, ExecutionContext, ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { Knex } from 'knex';
import { KNEX_CONNECTION } from '../../database/database.module';
import { Role } from '../enums';
import { matchesMarketingOrProduct } from '../access/commercial';

@Injectable()
export class CommercialAccessGuard implements CanActivate {
  constructor(@Inject(KNEX_CONNECTION) private readonly knex: Knex) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const user = context.switchToHttp().getRequest().user;
    if (!user) return false;
    if (user.role === Role.Admin) return true;

    if (matchesMarketingOrProduct(user.job_title) || matchesMarketingOrProduct(user.department_name)) {
      return true;
    }

    const names: string[] = [];
    if (user.department_id) {
      const dept = await this.knex('departments')
        .where({ id: user.department_id })
        .whereNull('deleted_at')
        .first('name');
      if (dept?.name) names.push(dept.name);
    }

    const headed: string[] = await this.knex('departments')
      .where({ company_id: user.company_id, manager_id: user.id })
      .whereNull('deleted_at')
      .pluck('name');

    if ([...names, ...headed].some((name) => matchesMarketingOrProduct(name))) {
      return true;
    }

    throw new ForbiddenException('Clients and newsletters are limited to Marketing and Product Management');
  }
}
