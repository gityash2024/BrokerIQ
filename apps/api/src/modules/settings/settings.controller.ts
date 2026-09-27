import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { SettingsService } from './settings.service';
import { CreateSettingsDto } from './dto/create-settings.dto';
import { UpdateSettingsDto } from './dto/update-settings.dto';

@ApiTags('Settings')
@Controller('settings')
export class SettingsController {
  constructor(private readonly service: SettingsService) {}

  @Get('feature-flags')
  @ApiOperation({ summary: 'Get all feature flags' })
  getFeatureFlags() {
    return this.service.getFeatureFlags();
  }

  @Patch('feature-flags/:id')
  @ApiOperation({ summary: 'Update a feature flag' })
  updateFeatureFlag(
    @Param('id') id: string,
    @Body() body: { isEnabled?: boolean; rolloutPercentage?: number },
  ) {
    return this.service.updateFeatureFlag(id, body);
  }

  @Get('integrations')
  @ApiOperation({ summary: 'Get all integrations' })
  getIntegrations() {
    return this.service.getIntegrations();
  }

  @Patch('integrations/:id')
  @ApiOperation({ summary: 'Update integration config or status' })
  updateIntegration(
    @Param('id') id: string,
    @Body() body: { status?: string; config?: any },
  ) {
    return this.service.updateIntegration(id, body);
  }

  @Post('upsert')
  @ApiOperation({ summary: 'Upsert system setting' })
  upsertSetting(@Body() body: { key: string; value: any; group?: string }) {
    return this.service.upsert(body.key, body.value, body.group);
  }

  @Post()
  @ApiOperation({ summary: 'Create Settings' })
  create(@Body() dto: CreateSettingsDto) { return this.service.create(dto); }

  @Get()
  @ApiOperation({ summary: 'Get all Settings' })
  findAll() { return this.service.findAll(); }

  @Get(':id')
  @ApiOperation({ summary: 'Get Settings by id' })
  findOne(@Param('id') id: string) { return this.service.findOne(id); }

  @Patch(':id')
  @ApiOperation({ summary: 'Update Settings' })
  update(@Param('id') id: string, @Body() dto: UpdateSettingsDto) { return this.service.update(id, dto); }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete Settings' })
  remove(@Param('id') id: string) { return this.service.remove(id); }
}
