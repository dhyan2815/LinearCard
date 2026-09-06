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
  
  body = body.replace(/this\.supabaseService\.client\.service/g, 'supabase.service');
  body = body.replace(/memberId,/g, 'memberId: memberId as string,');
  body = body.replace(/client\.req\(/g, 'client.request(');
  body = body.replace(/new URL\(\(req\.url \|\| ""\)\)\.\(req\.query\["tenantId"\] as string\)/g, '(req.query["tenantId"] as string)');

  fs.writeFileSync(file, body);
}
