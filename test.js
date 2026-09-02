fetch('http://localhost:3000/api/admin/send-otp', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ phone: '+917984806495' })
}).then(res => res.json()).then(console.log).catch(console.error);
