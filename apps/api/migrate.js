const fs = require('fs');
const path = require('path');

const API_DIR = path.join(__dirname, '../web/app/api');
const NEST_SRC = path.join(__dirname, 'src');

const map = {
  auth: ['send-otp', 'verify-otp', 'admin/send-otp', 'admin/verify-otp'],
  tenant: ['tenant/[slug]', 'tenants'],
  templates: ['templates', 'templates/[id]', 'templates/[id]/publish'],
  members: ['members', 'members/[id]', 'members/[id]/adjust-balance'],
  passes: ['generate-pass', 'validate-pass', 'update-pass', 'create-class', 'check-class', 'p/[id]'],
  dashboard: ['dashboard/stats'],
  settings: ['settings', 'admin/developer-settings'],
  notifications: ['notifications/log', 'notifications/send']
};

function processLogic(content, method) {
  if (!content) return '';
  const regex = new RegExp(`export async function ${method}\\(request: NextRequest.*?\\) {([\\s\\S]*?)^}`, 'm');
  let match = content.match(regex);
  if (!match) {
      const regex2 = new RegExp(`export async function ${method}\\(req.*?\\) {([\\s\\S]*?)^}`, 'm');
      match = content.match(regex2);
      if (!match) return `// Could not parse ${method} logic`;
  }
  let body = match[1];

  body = body.replace(/const (\w+) = await request\.json\(\);/g, 'const $1 = req.body;');
  body = body.replace(/let (\{.*?\}) = await request\.json\(\);/g, 'let $1 = req.body;');
  body = body.replace(/const (\{.*?\}) = await request\.json\(\);/g, 'const $1 = req.body;');
  body = body.replace(/const body = await request\.json\(\)\.catch\(\(\) => \(\{\}\)\);/g, 'const body = req.body;');
  body = body.replace(/request\.nextUrl\.origin/g, '"http://localhost:3000"');
  body = body.replace(/request\.headers\.get\((.*?)\)/g, 'req.headers[$1] as string');
  body = body.replace(/request\.url/g, '(req.url || "")');
  body = body.replace(/request\.cookies\.get\('admin_session'\)/g, 'req.cookies?.admin_session');
  body = body.replace(/request\./g, 'req.');
  
  body = body.replace(/params\.(\w+)/g, 'req.params.$1');

  body = body.replace(/const response = NextResponse\.json\((.*?)\);([\s\S]*?)response\.cookies\.set\((\{[\s\S]*?\})\);([\s\S]*?)return response;/g, 'res.cookie("admin_session", token, { httpOnly: true }); return res.status(200).json($1);');
  body = body.replace(/return NextResponse\.json\(([^;]+?),\s*\{\s*status:\s*(\d+)\s*\}\s*\);/g, 'return res.status($2).json($1);');
  body = body.replace(/return NextResponse\.json\(([^;]+?)\);/g, 'return res.status(200).json($1);');
  body = body.replace(/NextResponse\.redirect\((.*?)\)/g, 'res.redirect($1)');

  body = body.replace(/supabase\./g, 'this.supabaseService.client.');
  body = body.replace(/\{ supabase,\s*/g, '{ ');
  body = body.replace(/hashOtp\(/g, 'this.otpService.hashOtp(');
  body = body.replace(/verifyOtp\(/g, 'this.otpService.verifyOtp(');
  body = body.replace(/isOtpRateLimited\((.*?),\s*(.*?),\s*.*?\)/g, 'this.otpService.isOtpRateLimited($1, $2)');
  body = body.replace(/sendOtp\(/g, 'this.whatsappService.sendOtp(');
  body = body.replace(/sendPassLinkWithLog\(/g, 'this.whatsappService.sendPassLinkWithLog(');
  body = body.replace(/sendRedemptionReceiptWithLog\(/g, 'this.whatsappService.sendRedemptionReceiptWithLog(');
  body = body.replace(/createGoogleWalletPass\(/g, 'this.walletService.createGoogleWalletPass(');
  body = body.replace(/updateGenericObject\(/g, 'this.walletService.updateGenericObject(');
  body = body.replace(/createGenericClass\(/g, 'this.walletService.createGenericClass(');
  body = body.replace(/getGoogleAuthClient\(/g, 'this.walletService.getGoogleAuthClient(');
  body = body.replace(/logNotification\(/g, 'this.notifyService.logNotification(');

  body = body.replace(/VALID_ARCHETYPES/g, '["membership", "ticket", "generic"]'); // temporary hack for missing constants
  body = body.replace(/getTenantId\(req\)/g, '(req.headers["x-tenant-id"] || "default")');
  
  return body;
}

const serviceInjections = `
  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly otpService: OtpService,
    private readonly whatsappService: WhatsappService,
    private readonly walletService: WalletService,
    private readonly notifyService: NotifyService
  ) {}
`;

const modulesList = [];

for (const [moduleName, routes] of Object.entries(map)) {
  const cap = moduleName.charAt(0).toUpperCase() + moduleName.slice(1);
  modulesList.push(cap + 'Module');

  let controllerClass = `import { Controller, Get, Post, Put, Delete, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import { SupabaseService } from '../supabase/supabase.service';
import { OtpService } from '../notification/otp.service';
import { WhatsappService } from '../notification/whatsapp.service';
import { WalletService } from '../wallet/wallet.service';
import { NotifyService } from '../notification/notify.service';
import * as crypto from 'crypto';
import * as jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'secret';

@Controller('${moduleName}')
export class ${cap}Controller {
${serviceInjections}
`;

  for (const route of routes) {
    const routePath = path.join(API_DIR, route, 'route.ts');
    if (!fs.existsSync(routePath)) {
      console.log('Not found:', routePath);
      continue;
    }
    const content = fs.readFileSync(routePath, 'utf-8');
    
    const methods = ['GET', 'POST', 'PUT', 'DELETE'];
    for (const m of methods) {
      if (content.includes(`export async function ${m}(`)) {
        let endpoint = route.replace(moduleName, '').replace(/^\//, '');
        endpoint = endpoint.replace(/\[(\w+)\]/g, ':$1'); // Next.js params to Express params
        const methodName = m.toLowerCase() + route.replace(/[^a-zA-Z0-9]/g, '');
        const logic = processLogic(content, m);
        
        controllerClass += `
  @${m.charAt(0) + m.slice(1).toLowerCase()}('${endpoint}')
  async ${methodName}(@Req() req: Request, @Res() res: Response) {
    ${logic}
  }
`;
      }
    }
  }

  controllerClass += `}\n`;
  
  const modDir = path.join(NEST_SRC, moduleName);
  if (!fs.existsSync(modDir)) fs.mkdirSync(modDir);
  fs.writeFileSync(path.join(modDir, `${moduleName}.controller.ts`), controllerClass);

  const moduleContent = `import { Module } from '@nestjs/common';
import { ${cap}Controller } from './${moduleName}.controller';
import { SupabaseModule } from '../supabase/supabase.module';
import { NotificationModule } from '../notification/notification.module';
import { WalletModule } from '../wallet/wallet.module';

@Module({
  imports: [SupabaseModule, NotificationModule, WalletModule],
  controllers: [${cap}Controller],
})
export class ${cap}Module {}
`;
  fs.writeFileSync(path.join(modDir, `${moduleName}.module.ts`), moduleContent);
}

// Update app.module.ts
let appModuleContent = fs.readFileSync(path.join(NEST_SRC, 'app.module.ts'), 'utf-8');

// Add imports to top
for (const [moduleName, _] of Object.entries(map)) {
  const cap = moduleName.charAt(0).toUpperCase() + moduleName.slice(1);
  if (!appModuleContent.includes(`${cap}Module`)) {
    appModuleContent = `import { ${cap}Module } from './${moduleName}/${moduleName}.module';\n` + appModuleContent;
  }
}

appModuleContent = appModuleContent.replace(
  /imports: \[[^\]]*\]/,
  `imports: [\n    SupabaseModule,\n    WalletModule,\n    NotificationModule,\n    ${modulesList.join(',\n    ')}\n  ]`
);

fs.writeFileSync(path.join(NEST_SRC, 'app.module.ts'), appModuleContent);

