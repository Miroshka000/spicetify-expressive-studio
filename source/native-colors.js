// Color roles follow Spicetify v2.46.2's MIT-licensed CSS color table:
// https://github.com/spicetify/cli/blob/v2.46.2/src/preprocess/preprocess.go
// Apply them to native CSSOM declarations while enabled, without a dummy theme.
const ROLES = {
  '181818':'player','212121':'player','282828':'card','242424':'main-elevated','1f1f1f':'main-elevated',
  '121212':'main','1a1a1a':'highlight','2a2a2a':'highlight-elevated','000000':'sidebar',
  'b3b3b3':'subtext','a7a7a7':'subtext','1db954':'button','1877f2':'button',
  '1ed760':'button-active','1fdf64':'button-active','169c46':'button-active','535353':'button-disabled',
  '333333':'tab-active','7f7f7f':'misc','4687d6':'notification','2e77d0':'notification',
  'e22134':'notification-error','cd1a2b':'notification-error','ffffff':'text','f8f8f8':'text',
};
const TOKEN = /url\((?:[^()'"\\]|\\.|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')*\)|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|#[a-f0-9]{3,8}\b|rgba?\(\s*[\d.]+\s*[, ]\s*[\d.]+\s*[, ]\s*[\d.]+\s*(?:[,/]\s*[\d.]+%?\s*)?\)/gi;

export function nativeColorValue(value) {
  return value.replace(TOKEN, token => {
    if (/^(?:url\(|['"])/i.test(token)) return token;
    let hex, alpha = 1;
    if (token.startsWith('#')) {
      let digits = token.slice(1).toLowerCase();
      if (digits.length === 3 || digits.length === 4) digits = [...digits].map(c => c+c).join('');
      if (digits.length === 8) { alpha = Number.parseInt(digits.slice(6),16)/255; digits = digits.slice(0,6); }
      hex = digits;
    } else {
      const values = token.match(/[\d.]+%?/g);
      if (!values || values.slice(0,3).some(n => Number(n)>255)) return token;
      hex = values.slice(0,3).map(n => Math.round(Number(n)).toString(16).padStart(2,'0')).join('');
      if (values[3]) alpha = values[3].endsWith('%') ? Number.parseFloat(values[3])/100 : Number(values[3]);
    }
    if (alpha === 0 || alpha < 0 || alpha > 1) return token;
    const role = alpha < 1 && hex === '000000' ? 'shadow' : ROLES[hex];
    if (!role) return token;
    return alpha === 1 ? `var(--spice-${role})` : `rgba(var(--spice-rgb-${role}), ${Number(alpha.toFixed(6))})`;
  });
}

export function createNativeColors(doc = document) {
  let scanned = new WeakSet(), lengths = new WeakMap();
  const changes = [];
  function visit(rules) {
    for (const rule of rules) {
      if (scanned.has(rule)) continue;
      scanned.add(rule);
      if (rule.style) {
        const declaration = rule.style;
        for (const property of Array.from(declaration)) {
          if (property.startsWith('--spice-') || property === 'content' || property === 'font-family') continue;
          const value = declaration.getPropertyValue(property), updated = nativeColorValue(value);
          if (updated === value) continue;
          const priority = declaration.getPropertyPriority(property);
          declaration.setProperty(property, updated, priority);
          const applied = declaration.getPropertyValue(property);
          if (applied !== value) changes.push({ declaration, property, value, priority, applied });
        }
      }
      if (rule.cssRules) visit(rule.cssRules);
    }
  }
  return {
    scan() {
      for (const sheet of Array.from(doc.styleSheets)) {
        const owner = sheet.ownerNode, href = sheet.href || '';
        if (owner?.id?.startsWith('es-') || /(?:colors\.css|user\.css|spicetify-routes-|pip-mini-player)/i.test(href)) continue;
        try {
          const rules = sheet.cssRules;
          if (lengths.get(sheet) === rules.length) continue;
          lengths.set(sheet,rules.length); visit(rules);
        } catch { /* Cross-origin sheets stay untouched. */ }
      }
    },
    restore() {
      for (let i=changes.length-1;i>=0;i--) {
        const {declaration,property,value,priority,applied}=changes[i];
        // A different extension may have changed the rule after us.
        if (declaration.getPropertyValue(property) === applied) declaration.setProperty(property,value,priority);
      }
      changes.length=0; scanned=new WeakSet(); lengths=new WeakMap();
    },
  };
}
