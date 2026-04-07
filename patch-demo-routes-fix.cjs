const fs = require('fs');
let main = fs.readFileSync('src/main.jsx', 'utf8');
let changes = 0;

// Fix 1: /app → relative empty path
const old1 = `<Route path="/app" element={<Navigate to="/app/dashboard" replace />} />`;
const new1 = `<Route path="" element={<Navigate to="/app/dashboard" replace />} />`;
if (main.includes(old1)) { main = main.replace(old1, new1); changes++; console.log('✅ 1. /app → empty path'); }

// Fix 2: /app/:tab → relative :tab
const old2 = `<Route path="/app/:tab"`;
const new2 = `<Route path=":tab"`;
if (main.includes(old2)) { main = main.replace(old2, new2); changes++; console.log('✅ 2. /app/:tab → :tab'); }

// Fix 3: path="*" navigate target stays absolute (that's fine for Navigate)
// No change needed

if (changes > 0) {
  fs.writeFileSync('src/main.jsx', main);
  console.log('\n✅ Routes fixed to relative paths (' + changes + ' changes)');
} else {
  console.log('\n❌ No changes — anchors not found');
}
