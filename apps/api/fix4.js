const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, 'src/passes/passes.controller.ts');
let body = fs.readFileSync(file, 'utf-8');
body = body.replace(/memberId: memberId: pass\.memberId as string,/g, 'memberId: pass.memberId as string,');
fs.writeFileSync(file, body);
