#!/usr/bin/env node
// apps/api/prisma/schema-audit.js
// Forensic Schema Auditor for BrokerIQ Milestone 2

const fs = require('fs');
const path = require('path');

const schemaPath = path.resolve(__dirname, 'schema.prisma');
const schemaContent = fs.readFileSync(schemaPath, 'utf8');

console.log('╔════════════════════════════════════════════════════════════════════════════╗');
console.log('║                     BrokerIQ Schema Compliance Audit                       ║');
console.log('╚════════════════════════════════════════════════════════════════════════════╝');
console.log(`Auditing Schema: ${schemaPath}\n`);

// 1. Models & Enums Extraction
const modelRegex = /model\s+(\w+)\s+\{([^}]+)\}/gs;
const enumRegex = /enum\s+(\w+)\s+\{([^}]+)\}/gs;

const models = [];
let mMatch;
while ((mMatch = modelRegex.exec(schemaContent)) !== null) {
  models.push({ name: mMatch[1], body: mMatch[2] });
}

const enums = [];
let eMatch;
while ((eMatch = enumRegex.exec(schemaContent)) !== null) {
  enums.push({ name: eMatch[1], body: eMatch[2] });
}

console.log(`[1] Entity Inventory`);
console.log(`    Total Models Found: ${models.length} (Expected: 33)`);
console.log(`    Total Enums Found : ${enums.length}\n`);

const EXPECTED_33_MODELS = [
  // SaaS Core (12)
  'Organization', 'OrganizationMember', 'User', 'Plan', 'PlanFeature', 'FeatureLimit',
  'FeatureFlag', 'Subscription', 'Payment', 'Invoice', 'UsageCounter', 'Coupon',
  // CRM (8)
  'Customer', 'Lead', 'Property', 'PropertyOwner', 'FollowUp', 'SiteVisit', 'Task', 'Activity',
  // Communication (3)
  'Conversation', 'Message', 'WhatsAppTemplate',
  // Integrations (3)
  'Integration', 'IntegrationLog', 'WebhookEvent',
  // Automation (2)
  'AutomationRule', 'AutomationExecution',
  // AI (2)
  'AIResult', 'AIUsage',
  // Platform (3)
  'Notification', 'AuditLog', 'SystemSetting'
];

let failedChecks = 0;

// Verify all 33 models exist
console.log(`[2] Verifying All 33 Required Models Exist:`);
for (const reqModel of EXPECTED_33_MODELS) {
  const exists = models.some(m => m.name === reqModel);
  if (!exists) {
    console.error(`    ❌ MISSING MODEL: ${reqModel}`);
    failedChecks++;
  }
}
if (failedChecks === 0) {
  console.log(`    ✓ All 33 Models Verified Present!\n`);
}

// 2. Multi-Tenant Row Isolation Check (organizationId foreign key + index)
console.log(`[3] Verifying Multi-Tenant Row Isolation (organizationId FK + index):`);
const GLOBAL_MODELS = ['Organization', 'User', 'Plan', 'PlanFeature', 'FeatureLimit', 'Coupon'];

let tenantCheckFailures = 0;
for (const model of models) {
  if (GLOBAL_MODELS.includes(model.name)) {
    console.log(`    ℹ️  [GLOBAL PLATFORM ENTITY]: ${model.name}`);
    continue;
  }
  const hasOrgId = /organizationId\s+String\??/.test(model.body);
  const hasOrgRel = /organization\s+Organization\??\s+@relation/.test(model.body);
  const hasOrgIndex = /@@index\(\[organizationId/.test(model.body) || /@@unique\(\[organizationId/.test(model.body);

  if (!hasOrgId || !hasOrgRel || !hasOrgIndex) {
    console.error(`    ❌ TENANT ISOLATION FAILURE in ${model.name}: hasOrgId=${hasOrgId}, hasOrgRel=${hasOrgRel}, hasIndex=${hasOrgIndex}`);
    tenantCheckFailures++;
  } else {
    console.log(`    ✓ ${model.name}: organizationId FK & compound index verified`);
  }
}

if (tenantCheckFailures === 0) {
  console.log(`    ✓ 100% of Business Models Enforce Tenant Row Isolation!\n`);
} else {
  failedChecks += tenantCheckFailures;
}

// 3. Soft Delete Verification (deletedAt DateTime? + index)
console.log(`[4] Verifying Soft Delete (deletedAt DateTime? + @@index([organizationId, deletedAt])):`);
const SOFT_DELETE_MODELS = ['Customer', 'Lead', 'Property', 'FollowUp', 'SiteVisit'];
let softDeleteFailures = 0;

for (const modelName of SOFT_DELETE_MODELS) {
  const model = models.find(m => m.name === modelName);
  if (!model) {
    console.error(`    ❌ MISSING MODEL FOR SOFT DELETE: ${modelName}`);
    softDeleteFailures++;
    continue;
  }
  const hasDeletedAt = /deletedAt\s+DateTime\?/.test(model.body);
  const hasIndex = /@@index\(\[organizationId,\s*deletedAt\]\)/.test(model.body);

  if (!hasDeletedAt || !hasIndex) {
    console.error(`    ❌ SOFT DELETE FAILURE in ${modelName}: hasDeletedAt=${hasDeletedAt}, hasCompoundIndex=${hasIndex}`);
    softDeleteFailures++;
  } else {
    console.log(`    ✓ ${modelName}: deletedAt DateTime? and @@index([organizationId, deletedAt]) verified`);
  }
}

if (softDeleteFailures === 0) {
  console.log(`    ✓ 100% of Required Entities Implement Soft Delete Pattern!\n`);
} else {
  failedChecks += softDeleteFailures;
}

// 4. Financial Currency Check (currency String @default("INR"))
console.log(`[5] Verifying Financial Currency Code Standardization (@default("INR")):`);
const FINANCIAL_MODELS = ['Plan', 'Payment', 'Invoice', 'Lead', 'Property'];
let financialFailures = 0;

for (const modelName of FINANCIAL_MODELS) {
  const model = models.find(m => m.name === modelName);
  const hasCurrency = /currency\s+String\s+@default\("INR"\)/.test(model.body);
  if (!hasCurrency) {
    console.error(`    ❌ MISSING CURRENCY DEFAULT in ${modelName}`);
    financialFailures++;
  } else {
    console.log(`    ✓ ${modelName}: currency String @default("INR") verified`);
  }
}

if (financialFailures === 0) {
  console.log(`    ✓ 100% of Financial Entities Default to INR Currency!\n`);
} else {
  failedChecks += financialFailures;
}

// Audit Summary
console.log('╔════════════════════════════════════════════════════════════════════════════╗');
console.log('║                          AUDIT SUMMARY REPORT                              ║');
console.log('╠════════════════════════════════════════════════════════════════════════════╣');
console.log(`║ Total Models Checked      : ${String(models.length).padEnd(46)} ║`);
console.log(`║ Total Enums Checked       : ${String(enums.length).padEnd(46)} ║`);
console.log(`║ Tenant Isolated Models    : ${String(models.length - GLOBAL_MODELS.length).padEnd(46)} ║`);
console.log(`║ Soft Delete Models        : ${String(SOFT_DELETE_MODELS.length).padEnd(46)} ║`);
console.log(`║ Currency Standard Models  : ${String(FINANCIAL_MODELS.length).padEnd(46)} ║`);
console.log(`║ Total Failed Checks       : ${String(failedChecks).padEnd(46)} ║`);
console.log('╚════════════════════════════════════════════════════════════════════════════╝');

if (failedChecks === 0) {
  console.log('\n🎉 ALL SCHEMA COMPLIANCE CHECKS PASSED WITH 100% SUCCESS!\n');
  process.exit(0);
} else {
  console.error(`\n❌ SCHEMA AUDIT FAILED with ${failedChecks} violation(s)!\n`);
  process.exit(1);
}
