const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'apps/api/src');
const modulesDir = path.join(srcDir, 'modules');
const commonDir = path.join(srcDir, 'common');
const gatewaysDir = path.join(srcDir, 'gateways');

const mkdir = (dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
};

mkdir(modulesDir);
mkdir(commonDir);
mkdir(gatewaysDir);

const mainTs = "import { NestFactory } from '@nestjs/core';\n" +
"import { ValidationPipe } from '@nestjs/common';\n" +
"import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';\n" +
"import helmet from 'helmet';\n" +
"import * as compression from 'compression';\n" +
"import { AppModule } from './app.module';\n\n" +
"async function bootstrap() {\n" +
"  const app = await NestFactory.create(AppModule);\n\n" +
"  app.use(helmet());\n" +
"  app.enableCors();\n" +
"  app.use(compression());\n" +
"  \n" +
"  app.useGlobalPipes(new ValidationPipe({\n" +
"    whitelist: true,\n" +
"    transform: true,\n" +
"  }));\n\n" +
"  const config = new DocumentBuilder()\n" +
"    .setTitle('BrokerIQ API')\n" +
"    .setDescription('The BrokerIQ API description')\n" +
"    .setVersion('1.0')\n" +
"    .addBearerAuth()\n" +
"    .build();\n" +
"    \n" +
"  const document = SwaggerModule.createDocument(app, config);\n" +
"  SwaggerModule.setup('api', app, document);\n\n" +
"  await app.listen(process.env.PORT || 3000);\n" +
"}\n" +
"bootstrap();\n";
fs.writeFileSync(path.join(srcDir, 'main.ts'), mainTs);

const commonFiles = {
  'filters/all-exceptions.filter.ts': "import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';\n@Catch()\nexport class AllExceptionsFilter implements ExceptionFilter {\n  catch(exception: unknown, host: ArgumentsHost) {\n    const ctx = host.switchToHttp();\n    const response = ctx.getResponse();\n    const status = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;\n    response.status(status).json({ statusCode: status, timestamp: new Date().toISOString(), path: ctx.getRequest().url });\n  }\n}",
  'interceptors/transform.interceptor.ts': "import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';\nimport { Observable } from 'rxjs';\nimport { map } from 'rxjs/operators';\nexport interface Response<T> { data: T; }\n@Injectable()\nexport class TransformInterceptor<T> implements NestInterceptor<T, Response<T>> {\n  intercept(context: ExecutionContext, next: CallHandler): Observable<Response<T>> {\n    return next.handle().pipe(map(data => ({ data })));\n  }\n}",
  'dto/pagination.dto.ts': "import { IsOptional, IsInt, Min } from 'class-validator';\nimport { Type } from 'class-transformer';\nexport class PaginationDto {\n  @IsOptional()\n  @Type(() => Number)\n  @IsInt()\n  @Min(1)\n  page?: number;\n\n  @IsOptional()\n  @Type(() => Number)\n  @IsInt()\n  @Min(1)\n  limit?: number;\n}",
  'dto/base.dto.ts': "export class BaseDto {}"
};
mkdir(path.join(commonDir, 'filters'));
mkdir(path.join(commonDir, 'interceptors'));
mkdir(path.join(commonDir, 'dto'));
for (const [file, content] of Object.entries(commonFiles)) {
  fs.writeFileSync(path.join(commonDir, file), content);
}

const modules = [
  'auth', 'organizations', 'users', 'plans', 'subscriptions', 'customers',
  'leads', 'properties', 'follow-ups', 'site-visits', 'health', 'payments',
  'ai', 'whatsapp', 'housing', 'automation', 'analytics', 'notifications',
  'storage', 'settings', 'credentials', 'audit'
];

const camelCase = (str) => str.replace(/-([a-z])/g, (g) => g[1].toUpperCase());
const pascalCase = (str) => { const camel = camelCase(str); return camel.charAt(0).toUpperCase() + camel.slice(1); };

let appModuleImports = ["import { PrismaModule } from './prisma/prisma.module';"];
let appModuleModules = ['PrismaModule'];

modules.forEach(mod => {
  const modDir = path.join(modulesDir, mod);
  mkdir(modDir);
  mkdir(path.join(modDir, 'dto'));
  
  const className = pascalCase(mod);
  
  fs.writeFileSync(path.join(modDir, "dto/create-" + mod + ".dto.ts"), "export class Create" + className + "Dto {}");
  fs.writeFileSync(path.join(modDir, "dto/update-" + mod + ".dto.ts"), "import { PartialType } from '@nestjs/swagger';\nimport { Create" + className + "Dto } from './create-" + mod + ".dto';\nexport class Update" + className + "Dto extends PartialType(Create" + className + "Dto) {}");

  const controllerContent = "import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';\n" +
"import { ApiTags, ApiOperation } from '@nestjs/swagger';\n" +
"import { " + className + "Service } from './" + mod + ".service';\n" +
"import { Create" + className + "Dto } from './dto/create-" + mod + ".dto';\n" +
"import { Update" + className + "Dto } from './dto/update-" + mod + ".dto';\n\n" +
"@ApiTags('" + className + "')\n" +
"@Controller('" + mod + "')\n" +
"export class " + className + "Controller {\n" +
"  constructor(private readonly service: " + className + "Service) {}\n\n" +
"  @Post()\n" +
"  @ApiOperation({ summary: 'Create " + className + "' })\n" +
"  create(@Body() dto: Create" + className + "Dto) { return this.service.create(dto); }\n\n" +
"  @Get()\n" +
"  @ApiOperation({ summary: 'Get all " + className + "' })\n" +
"  findAll() { return this.service.findAll(); }\n\n" +
"  @Get(':id')\n" +
"  @ApiOperation({ summary: 'Get " + className + " by id' })\n" +
"  findOne(@Param('id') id: string) { return this.service.findOne(id); }\n\n" +
"  @Patch(':id')\n" +
"  @ApiOperation({ summary: 'Update " + className + "' })\n" +
"  update(@Param('id') id: string, @Body() dto: Update" + className + "Dto) { return this.service.update(id, dto); }\n\n" +
"  @Delete(':id')\n" +
"  @ApiOperation({ summary: 'Delete " + className + "' })\n" +
"  remove(@Param('id') id: string) { return this.service.remove(id); }\n" +
"}\n";
  fs.writeFileSync(path.join(modDir, mod + ".controller.ts"), controllerContent);

  const serviceContent = "import { Injectable } from '@nestjs/common';\n" +
"import { PrismaService } from '../../prisma/prisma.service';\n" +
"import { Create" + className + "Dto } from './dto/create-" + mod + ".dto';\n" +
"import { Update" + className + "Dto } from './dto/update-" + mod + ".dto';\n\n" +
"@Injectable()\n" +
"export class " + className + "Service {\n" +
"  constructor(private readonly prisma: PrismaService) {}\n\n" +
"  create(dto: Create" + className + "Dto) { return 'This action adds a new " + className + "'; }\n" +
"  findAll() { return 'This action returns all " + className + "'; }\n" +
"  findOne(id: string) { return 'This action returns a #' + id + ' " + className + "'; }\n" +
"  update(id: string, dto: Update" + className + "Dto) { return 'This action updates a #' + id + ' " + className + "'; }\n" +
"  remove(id: string) { return 'This action removes a #' + id + ' " + className + "'; }\n" +
"}\n";
  fs.writeFileSync(path.join(modDir, mod + ".service.ts"), serviceContent);

  const moduleContent = "import { Module } from '@nestjs/common';\n" +
"import { " + className + "Service } from './" + mod + ".service';\n" +
"import { " + className + "Controller } from './" + mod + ".controller';\n\n" +
"@Module({\n" +
"  controllers: [" + className + "Controller],\n" +
"  providers: [" + className + "Service],\n" +
"  exports: [" + className + "Service],\n" +
"})\n" +
"export class " + className + "Module {}\n";
  fs.writeFileSync(path.join(modDir, mod + ".module.ts"), moduleContent);

  appModuleImports.push("import { " + className + "Module } from './modules/" + mod + "/" + mod + ".module';");
  appModuleModules.push(className + "Module");
});

const authDir = path.join(modulesDir, 'auth');
fs.writeFileSync(path.join(authDir, 'jwt.strategy.ts'), "import { Injectable } from '@nestjs/common'; export class JwtStrategy {}");
fs.writeFileSync(path.join(authDir, 'local.strategy.ts'), "import { Injectable } from '@nestjs/common'; export class LocalStrategy {}");
mkdir(path.join(authDir, 'guards'));
fs.writeFileSync(path.join(authDir, 'guards/jwt-auth.guard.ts'), "import { Injectable } from '@nestjs/common'; export class JwtAuthGuard {}");
fs.writeFileSync(path.join(authDir, 'guards/roles.guard.ts'), "import { Injectable } from '@nestjs/common'; export class RolesGuard {}");
fs.writeFileSync(path.join(authDir, 'guards/tenant.guard.ts'), "import { Injectable } from '@nestjs/common'; export class TenantGuard {}");
mkdir(path.join(authDir, 'decorators'));
fs.writeFileSync(path.join(authDir, 'decorators/current-user.decorator.ts'), "import { createParamDecorator } from '@nestjs/common'; export const CurrentUser = createParamDecorator(() => {});");
fs.writeFileSync(path.join(authDir, 'decorators/roles.decorator.ts'), "import { SetMetadata } from '@nestjs/common'; export const Roles = (...roles: string[]) => SetMetadata('roles', roles);");
fs.writeFileSync(path.join(authDir, 'decorators/public.decorator.ts'), "import { SetMetadata } from '@nestjs/common'; export const Public = () => SetMetadata('isPublic', true);");

const gwContent = "import { WebSocketGateway, WebSocketServer, SubscribeMessage, MessageBody } from '@nestjs/websockets';\n" +
"import { Server } from 'socket.io';\n\n" +
"@WebSocketGateway({ cors: true })\n" +
"export class AppGateway {\n" +
"  @WebSocketServer()\n" +
"  server: Server;\n\n" +
"  @SubscribeMessage('events')\n" +
"  handleEvent(@MessageBody() data: string): string {\n" +
"    return data;\n" +
"  }\n" +
"}\n";
fs.writeFileSync(path.join(gatewaysDir, 'app.gateway.ts'), gwContent);
appModuleImports.push("import { AppGateway } from './gateways/app.gateway';");
appModuleModules.push("AppGateway");

const appModuleTs = "import { Module } from '@nestjs/common';\n" +
appModuleImports.join('\n') + "\n\n" +
"@Module({\n" +
"  imports: [\n" +
"    " + appModuleModules.filter(m => m.endsWith('Module')).join(',\n    ') + "\n" +
"  ],\n" +
"  controllers: [],\n" +
"  providers: [\n" +
"    " + appModuleModules.filter(m => !m.endsWith('Module')).join(',\n    ') + "\n" +
"  ],\n" +
"})\n" +
"export class AppModule {}\n";
fs.writeFileSync(path.join(srcDir, 'app.module.ts'), appModuleTs);

console.log('Scaffolding complete!');
