const fs = require('fs');
const path = require('path');

const schemaPath = path.join(__dirname, 'apps/api/prisma/schema.prisma');
const schemaContent = fs.readFileSync(schemaPath, 'utf8');

// Parse models and enums from prisma schema
const models = {};
const enums = {};
let currentModel = null;
let currentEnum = null;

const lines = schemaContent.split('\n');
for (const line of lines) {
  const trimmed = line.trim();
  if (trimmed.startsWith('model ')) {
    currentModel = trimmed.split(' ')[1];
    models[currentModel] = [];
  } else if (trimmed.startsWith('enum ')) {
    currentEnum = trimmed.split(' ')[1];
    enums[currentEnum] = [];
  } else if (trimmed === '}') {
    currentModel = null;
    currentEnum = null;
  } else if (currentModel && trimmed && !trimmed.startsWith('@@') && !trimmed.startsWith('//')) {
    const parts = trimmed.split(/\s+/);
    if (parts.length >= 2) {
      const name = parts[0];
      const typeStr = parts[1];
      if (name && typeStr && !typeStr.includes('(')) {
        models[currentModel].push({ name, type: typeStr });
      }
    }
  } else if (currentEnum && trimmed && !trimmed.startsWith('//')) {
    enums[currentEnum].push(trimmed);
  }
}

// Map models to our module names
const moduleToModel = {
  organizations: 'Organization',
  users: 'User',
  plans: 'Plan',
  subscriptions: 'Subscription',
  customers: 'Customer',
  leads: 'Lead',
  properties: 'Property',
  'follow-ups': 'FollowUp',
  'site-visits': 'SiteVisit',
  payments: 'Payment',
  ai: 'AIResult', // Just a placeholder if AI doesn't have a direct matching CRUD
  whatsapp: 'Message',
  housing: null,
  automation: 'AutomationRule',
  analytics: 'UsageCounter',
  notifications: 'Notification',
  storage: null,
  settings: 'SystemSetting',
  credentials: null,
  audit: 'AuditLog'
};

const mapPrismaTypeToTSType = (prismaType) => {
  const isArray = prismaType.endsWith('[]');
  const isOptional = prismaType.endsWith('?');
  const baseType = prismaType.replace('[]', '').replace('?', '');
  
  let tsType = 'string';
  let validator = '@IsString()';
  
  if (baseType === 'Int' || baseType === 'Float' || baseType === 'Decimal') {
    tsType = 'number';
    validator = '@IsNumber()';
  } else if (baseType === 'Boolean') {
    tsType = 'boolean';
    validator = '@IsBoolean()';
  } else if (baseType === 'DateTime') {
    tsType = 'Date';
    validator = '@IsDateString()';
  } else if (baseType === 'Json') {
    tsType = 'any';
    validator = '@IsObject()';
  } else if (enums[baseType]) {
    tsType = baseType;
    validator = `@IsEnum(${baseType})`;
  } else {
    // Possibly a relation
    return null; 
  }

  if (isArray) {
    tsType = `${tsType}[]`;
    validator = `${validator}\n  @IsArray()`;
  }
  if (isOptional) {
    validator = `@IsOptional()\n  ${validator}`;
  } else {
    validator = `@IsNotEmpty()\n  ${validator}`;
  }

  return { tsType, validator, baseType, isOptional, isArray };
};

const srcDir = path.join(__dirname, 'apps/api/src');
const modulesDir = path.join(srcDir, 'modules');

Object.keys(moduleToModel).forEach(mod => {
  const modelName = moduleToModel[mod];
  const modDir = path.join(modulesDir, mod);
  if (!fs.existsSync(modDir)) return;

  const className = mod.split('-').map(p => p.charAt(0).toUpperCase() + p.slice(1)).join('');
  let createDtoContent = `import { IsString, IsNumber, IsBoolean, IsDateString, IsOptional, IsNotEmpty, IsArray, IsEnum, IsObject } from 'class-validator';\n`;
  
  const modelFields = models[modelName] || [];
  
  const enumImports = new Set();
  
  let dtoFields = [];
  modelFields.forEach(field => {
    // Skip id, createdAt, updatedAt
    if (['id', 'createdAt', 'updatedAt'].includes(field.name)) return;
    const mapped = mapPrismaTypeToTSType(field.type);
    if (mapped) {
      if (enums[mapped.baseType]) {
        enumImports.add(mapped.baseType);
      }
      dtoFields.push(`  ${mapped.validator}\n  ${field.name}${mapped.isOptional ? '?' : '!'}: ${mapped.tsType};`);
    }
  });

  if (enumImports.size > 0) {
    createDtoContent += `import { ${Array.from(enumImports).join(', ')} } from '@prisma/client';\n`;
  }
  
  createDtoContent += `\nexport class Create${className}Dto {\n${dtoFields.join('\n\n')}\n}\n`;

  fs.writeFileSync(path.join(modDir, `dto/create-${mod}.dto.ts`), createDtoContent);
  
  const updateDtoContent = `import { PartialType } from '@nestjs/swagger';\nimport { Create${className}Dto } from './create-${mod}.dto';\n\nexport class Update${className}Dto extends PartialType(Create${className}Dto) {}\n`;
  fs.writeFileSync(path.join(modDir, `dto/update-${mod}.dto.ts`), updateDtoContent);

  // Update Service
  const lowerCamelClass = className.charAt(0).toLowerCase() + className.slice(1);
  const prismaModel = modelName ? modelName.charAt(0).toLowerCase() + modelName.slice(1) : null;
  
  let serviceContent = `import { Injectable } from '@nestjs/common';\nimport { PrismaService } from '../../prisma/prisma.service';\nimport { Create${className}Dto } from './dto/create-${mod}.dto';\nimport { Update${className}Dto } from './dto/update-${mod}.dto';\n\n@Injectable()\nexport class ${className}Service {\n  constructor(private readonly prisma: PrismaService) {}\n`;
  
  if (prismaModel) {
    serviceContent += `
  async create(dto: Create${className}Dto) {
    return this.prisma.${prismaModel}.create({ data: dto as any });
  }

  async findAll() {
    return this.prisma.${prismaModel}.findMany();
  }

  async findOne(id: string) {
    return this.prisma.${prismaModel}.findUnique({ where: { id } as any });
  }

  async update(id: string, dto: Update${className}Dto) {
    return this.prisma.${prismaModel}.update({
      where: { id } as any,
      data: dto as any,
    });
  }

  async remove(id: string) {
    return this.prisma.${prismaModel}.delete({ where: { id } as any });
  }
}\n`;
  } else {
    serviceContent += `
  create(dto: Create${className}Dto) { return 'This action adds a new ${className}'; }
  findAll() { return 'This action returns all ${className}'; }
  findOne(id: string) { return 'This action returns a #' + id + ' ${className}'; }
  update(id: string, dto: Update${className}Dto) { return 'This action updates a #' + id + ' ${className}'; }
  remove(id: string) { return 'This action removes a #' + id + ' ${className}'; }
}\n`;
  }
  
  fs.writeFileSync(path.join(modDir, `${mod}.service.ts`), serviceContent);
});

console.log('DTOs and Services updated with Prisma schema mapping.');
