const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');

// Remove the window.onerror script that might interfere
const scriptStart = html.indexOf('<script>\nwindow.onerror');
const scriptEnd = html.indexOf('</script>', scriptStart);
if (scriptStart > -1 && scriptEnd > -1) {
  html = html.substring(0, scriptStart) + html.substring(scriptEnd + 9);
  fs.writeFileSync('index.html', html);
  console.log('✅ Removed window.onerror from index.html');
} else {
  // Try alternate format
  const alt = html.match(/<script>\s*window\.onerror[\s\S]*?<\/script>/);
  if (alt) {
    html = html.replace(alt[0], '');
    fs.writeFileSync('index.html', html);
    console.log('✅ Removed window.onerror (alt format)');
  } else {
    console.log('❌ No window.onerror found');
  }
}
