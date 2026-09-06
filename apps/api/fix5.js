const fs = require('fs');
const files = ['src/auth/auth.controller.ts', 'src/members/members.controller.ts', 'src/passes/p.controller.ts', 'src/templates/templates.controller.ts'];
files.forEach(f => {
  let s = fs.readFileSync(f, 'utf-8');
  s = s.replace(/\\`/g, '`');
  s = s.replace(/\\\$/g, '$');
  fs.writeFileSync(f, s);
});
