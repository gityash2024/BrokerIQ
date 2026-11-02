import type { Response } from 'express';
import { z } from 'zod';
import { Controller, Get, Header, Param, Query, Res } from '@nestjs/common';
import { adminBusinessQuerySchema, adminBusinessResourceSchema, type AdminBusinessQuery, type AdminBusinessResource } from '@brokeriq/shared';
import { CurrentUser, Roles, type RequestUser } from '../../common/decorators';
import { ZodPipe } from '../../common/pipes/zod.pipe';
import { AdminBusinessService } from './admin-business.service';

@Controller('admin/business')
@Roles('SUPER_ADMIN')
export class AdminBusinessController {
  constructor(private readonly business: AdminBusinessService) {}
  @Get('counts') @Header('Cache-Control', 'private, no-store') counts(@Query(new ZodPipe(adminBusinessQuerySchema)) q: AdminBusinessQuery) {
    return this.business.counts(q);
  }
  @Get('hierarchy/:kind') @Header('Cache-Control', 'private, no-store') hierarchy(
    @Param('kind', new ZodPipe(z.enum(['organizations', 'members']))) kind: 'organizations' | 'members',
    @Query(
      new ZodPipe(
        z.object({
          organizationId: z.string().max(100).optional(),
          search: z.string().max(200).optional(),
          page: z.coerce.number().int().positive().default(1),
        }),
      ),
    )
    q: { organizationId?: string; search?: string; page: number },
  ) {
    return this.business.hierarchy(kind, q);
  }
  @Get(':resource/export') async export(
    @Param('resource', new ZodPipe(adminBusinessResourceSchema)) r: AdminBusinessResource,
    @Query(new ZodPipe(adminBusinessQuerySchema)) q: AdminBusinessQuery,
    @CurrentUser() u: RequestUser,
    @Res() res: Response,
    @Query('ids') ids?: unknown,
  ) {
    const parsedIds = new ZodPipe(z.object({ ids: z.string().max(202000).optional() })).transform({ ids });
    const selection =
      parsedIds.ids === undefined ? undefined : new ZodPipe(z.array(z.string().min(1).max(100)).min(1).max(2000)).transform(parsedIds.ids.split(','));
    const csv = await this.business.export(r, q, u, selection);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="brokeriq-${r}.csv"`);
    res.setHeader('Cache-Control', 'private, no-store');
    res.send('\uFEFF' + csv);
  }
  @Get(':resource') @Header('Cache-Control', 'private, no-store') list(
    @Param('resource', new ZodPipe(adminBusinessResourceSchema)) r: AdminBusinessResource,
    @Query(new ZodPipe(adminBusinessQuerySchema)) q: AdminBusinessQuery,
    @CurrentUser() u: RequestUser,
  ) {
    return this.business.list(r, q, u);
  }
  @Get(':resource/:id') @Header('Cache-Control', 'private, no-store') detail(
    @Param('resource', new ZodPipe(adminBusinessResourceSchema)) r: AdminBusinessResource,
    @Param('id') id: string,
    @Query(new ZodPipe(adminBusinessQuerySchema)) q: AdminBusinessQuery,
    @CurrentUser() u: RequestUser,
  ) {
    return this.business.detail(r, id, q, u);
  }
}
