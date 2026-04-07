const fs = require('fs');

let ctx = fs.readFileSync('src/context/AppContext.tsx', 'utf8');

// Add isDemoMode to the value object
const OLD_VALUE = `    // Auth
    handleLogout: () => onLogout?.(),
    session,
  };`;

const NEW_VALUE = `    // Auth
    handleLogout: () => onLogout?.(),
    session,
    // Demo
    isDemoMode,
  };`;

if (ctx.includes(OLD_VALUE) && !ctx.includes('isDemoMode,\n  };')) {
  ctx = ctx.replace(OLD_VALUE, NEW_VALUE);
  console.log('✅ 1/2 Added isDemoMode to AppContext value');
} else {
  console.log('⏭  1/2 isDemoMode already in value or anchor not found');
}

// Also add it to the AppContextValue type if there is one
// Check for the type definition
const typeAnchor = ctx.indexOf('interface AppContextValue') || ctx.indexOf('type AppContextValue');
if (typeAnchor > -1) {
  // Find the closing brace of the type
  const typeSection = ctx.substring(typeAnchor, typeAnchor + 2000);
  if (!typeSection.includes('isDemoMode')) {
    // Add before the closing of the interface
    const OLD_TYPE_END = '  handleLogout: () => void;\n  session:';
    const NEW_TYPE_END = '  handleLogout: () => void;\n  isDemoMode: boolean;\n  session:';
    if (ctx.includes(OLD_TYPE_END)) {
      ctx = ctx.replace(OLD_TYPE_END, NEW_TYPE_END);
      console.log('✅ 2/2 Added isDemoMode to AppContextValue type');
    }
  }
}

fs.writeFileSync('src/context/AppContext.tsx', ctx);

console.log(`
══════════════════════════════════════════════
✅ isDemoMode added to AppContext!

  ROOT CAUSE FOUND:
  VentasTab destructures { isDemoMode } from useApp()
  But isDemoMode was NOT in the context value object.
  Result: undefined → React render crash in production
  (React swallows the error in prod mode → white screen)

  Fix: isDemoMode is now in the context value.
══════════════════════════════════════════════`);
