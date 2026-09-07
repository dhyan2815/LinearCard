const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = path.resolve(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(file));
    } else {
      if (file.endsWith('.controller.ts')) results.push(file);
    }
  });
  return results;
}

const controllers = walk(path.join(__dirname, 'src'));

for (const file of controllers) {
  let body = fs.readFileSync(file, 'utf-8');
  
  body = body.replace(/await supabase/g, 'await this.supabaseService.client');
  body = body.replace(/supabase\./g, 'this.supabaseService.client.');
  body = body.replace(/const \{ id: memberId \} = await params;/g, 'const memberId = req.params.id;');
  body = body.replace(/req\.params\.get\('(.*?)'\)/g, '(req.query["$1"] as string)');
  body = body.replace(/searchParams\.get\('(.*?)'\)/g, '(req.query["$1"] as string)');
  body = body.replace(/VALID_CHANNELS/g, '["whatsapp", "wallet_push"]');
  body = body.replace(/channel as Channel/g, 'channel as any');
  body = body.replace(/await wahaPost\(/g, 'await this.whatsappService["wahaPost"](');
  body = body.replace(/await getTenantId\(.*?\)/g, '(req.headers["x-tenant-id"] as string || "default")');
  body = body.replace(/request\.json\(\)\.catch\(\(\) => \(\{\}\)\)/g, 'Promise.resolve(req.body)');
  body = body.replace(/request\.cookies\.get\('admin_session'\)/g, 'req.cookies?.admin_session');

  // Fix any remaining bare 'request'
  body = body.replace(/request/g, 'req');

  fs.writeFileSync(file, body);
}
