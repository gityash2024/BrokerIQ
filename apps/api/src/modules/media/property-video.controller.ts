import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { z } from 'zod';
import { CurrentUser, Roles, type RequestUser } from '../../common/decorators';
import { ZodPipe } from '../../common/pipes/zod.pipe';
import { PropertyVideoService } from './property-video.service';

const upload = z.object({ contentType: z.string().max(60) });
const selection = z.object({ indices: z.array(z.number().int().min(0).max(4)).min(1).max(5) });

@Controller('media/property-video')
@Roles('BROKER_ADMIN', 'SUB_BROKER_ADMIN', 'BROKER_AGENT', 'PROPERTY_OWNER', 'SUPER_ADMIN')
export class PropertyVideoController {
  constructor(private readonly video: PropertyVideoService) {}

  @Post()
  create(@Body(new ZodPipe(upload)) body: z.infer<typeof upload>, @CurrentUser() user: RequestUser) {
    return this.video.create(body.contentType, user);
  }

  @Post(':id/start')
  start(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.video.start(id, user);
  }

  @Get(':id')
  status(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.video.status(id, user);
  }

  @Post(':id/save')
  save(@Param('id') id: string, @Body(new ZodPipe(selection)) body: z.infer<typeof selection>, @CurrentUser() user: RequestUser) {
    return this.video.save(id, body.indices, user);
  }

  @Post(':id/complete')
  complete(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.video.complete(id, user);
  }

  @Delete(':id')
  cancel(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.video.cancel(id, user);
  }
}
