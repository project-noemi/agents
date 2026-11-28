'use strict';

/**
 * HTML → markdown for tracker fields that arrive as HTML (Azure DevOps
 * System.Description, Microsoft.VSTS.TCM.ReproSteps, AcceptanceCriteria).
 *
 * The issue-coding loop's heuristics (sufficiency.js PATH_RE, plan.js
 * extractDoneWhen) read GitHub-flavoured markdown: `## Done when` headings,
 * `-` lists, inline code with repo paths, fenced code. This module turns the
 * *visible* part of an HTML field into that shape.
 *
 * Security model. The output feeds LLM prompts and the secret scanner, so
 * the converter splits the field into two channels:
 *   - `markdown`: what a human reviewer sees rendered in the tracker.
 *   - `hidden`:   text present in the field but not rendered (comments,
 *                 script/style/template/noscript, hidden/aria-hidden/
 *                 display:none-style elements, title/alt/data-* values,
 *                 dropped javascript:/data: hrefs).
 * Hidden text never leaks into `markdown`. coding-loop/run.js secret-scans
 * `hidden` with the body and REFUSES an item (`hidden-instructions`, before
 * any model call) when it carries instruction-like content; anything else
 * there is only scanned. Where the
 * parser has to guess (malformed nesting, depth caps), it errs toward
 * keeping an element open — i.e. toward *more* hidden text, never less.
 *
 * Robustness. The input is attacker-controlled. Parsing is a single
 * forward state machine (indexOf + char scans, no backtracking regexes over
 * the input), stack searches are bounded, tree depth is capped, and list /
 * quote indentation stops growing past a fixed depth, so work stays roughly
 * linear in the (capped) input length. No dependencies.
 */

const DEFAULT_MAX_LENGTH = 200000;

/** Tree nodes beyond this depth are flattened into their ancestor. */
const MAX_NODE_DEPTH = 100;
/** End-tag / implicit-close searches look at most this far down the stack. */
const STACK_SEARCH_LIMIT = 256;
/** Lists / blockquotes deeper than this stop adding indentation. */
const MAX_INDENT_DEPTH = 8;
/**
 * Wrapping renderers (emphasis, links, headings, list items, quotes, tables)
 * re-scan their rendered content. Past this many nested wrappers they
 * degrade to plain text so the total cost stays O(n * MAX_WRAP_DEPTH).
 */
const MAX_WRAP_DEPTH = 12;

// Internal markers. Input occurrences are replaced with U+FFFD up front so
// field content can never forge a placeholder or an indentation marker.
const PH = '\u0000'; // fenced-block placeholder delimiter
const IND = '\u0001'; // indentation marker (becomes a space at the end)

const VOID_TAGS = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'keygen',
  'link', 'meta', 'param', 'source', 'track', 'wbr',
]);

/** Content up to the matching end tag is raw text, not markup. */
const RAW_TEXT_TAGS = new Set([
  'script', 'style', 'xmp', 'iframe', 'noembed', 'noframes', 'textarea', 'title',
]);
/** Raw-text tags whose entities are still decoded (RCDATA). */
const RCDATA_TAGS = new Set(['textarea', 'title']);

/** Never rendered by a browser; everything inside goes to `hidden`. */
const HIDDEN_TAGS = new Set([
  'script', 'style', 'template', 'noscript', 'head', 'title', 'iframe',
  'noembed', 'noframes', 'meta', 'link', 'base',
]);

/**
 * Attribute values that are present but not part of the rendered text.
 * `alt` is also rendered as `[alt]` for images (spec of this converter), but
 * it is still reported here so the scanner sees it in the hidden channel.
 */
const HIDDEN_ATTRS = new Set([
  'title', 'alt', 'aria-label', 'aria-description', 'aria-placeholder',
  'placeholder', 'content', 'srcdoc', 'label', 'summary',
]);

const HEADINGS = new Set(['h1', 'h2', 'h3', 'h4', 'h5', 'h6']);

const BLOCK_TAGS = new Set([
  'p', 'div', 'section', 'article', 'header', 'footer', 'main', 'nav',
  'aside', 'figure', 'figcaption', 'details', 'summary', 'address', 'center',
  'form', 'fieldset', 'legend', 'caption', 'dl', 'dt', 'dd', 'body', 'html',
  'tr', 'textarea', 'xmp', 'listing', 'hgroup', 'menu',
]);

/** Start tags that implicitly close an open <p> (HTML "closes a p element"). */
const CLOSES_P = new Set([
  'address', 'article', 'aside', 'blockquote', 'center', 'details', 'dialog',
  'dir', 'div', 'dl', 'fieldset', 'figcaption', 'figure', 'footer', 'form',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'header', 'hgroup', 'hr', 'main',
  'menu', 'nav', 'ol', 'p', 'pre', 'section', 'summary', 'table', 'ul',
  'listing', 'xmp',
]);

/** Elements that may sit between an open <p> and the next block start. */
const PHRASING = new Set([
  'a', 'abbr', 'b', 'bdi', 'bdo', 'cite', 'code', 'data', 'dfn', 'em', 'font',
  'i', 'kbd', 'mark', 'q', 's', 'samp', 'small', 'span', 'strike', 'strong',
  'sub', 'sup', 'time', 'tt', 'u', 'var', 'del', 'ins', 'label',
]);

const LIST_SCOPE = new Set(['ul', 'ol', 'menu', 'dir']);
const DL_SCOPE = new Set(['dl']);
const CELL_SCOPE = new Set(['table', 'tr']);
const ROW_SCOPE = new Set(['table', 'thead', 'tbody', 'tfoot']);
const SECTION_SCOPE = new Set(['table']);
const ONE_LI = new Set(['li']);
const DT_DD = new Set(['dt', 'dd']);
const TD_TH = new Set(['td', 'th']);
const ONE_TR = new Set(['tr']);
const TSECTIONS = new Set(['thead', 'tbody', 'tfoot']);

const NAMED_ENTITIES = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  copy: '©', reg: '®', trade: '™', hellip: '…',
  mdash: '—', ndash: '–', lsquo: '‘', rsquo: '’',
  ldquo: '“', rdquo: '”', bull: '•', middot: '·',
  times: '×', divide: '÷', laquo: '«', raquo: '»',
  deg: '°', plusmn: '±', para: '¶', sect: '§',
  euro: '€', pound: '£', yen: '¥', cent: '¢',
  larr: '←', rarr: '→', uarr: '↑', darr: '↓',
  ensp: ' ', emsp: ' ', thinsp: ' ', zwnj: '‌',
  zwj: '‍', shy: '­', Tab: '\t', NewLine: '\n',
};
/** Legacy entities browsers accept without the trailing semicolon. */
const LEGACY_ENTITIES = new Set(['amp', 'lt', 'gt', 'quot', 'nbsp', 'copy', 'reg']);

function isWs(c) {
  return c === 32 || c === 9 || c === 10 || c === 12 || c === 13;
}

function isAlpha(c) {
  return (c >= 65 && c <= 90) || (c >= 97 && c <= 122);
}

function isDigit(c) {
  return c >= 48 && c <= 57;
}

function isHex(c) {
  return isDigit(c) || (c >= 65 && c <= 70) || (c >= 97 && c <= 102);
}

function isAlnum(c) {
  return isAlpha(c) || isDigit(c);
}

/**
 * Single forward pass; every branch advances `i`. Unknown named entities are
 * left literally (so `a&b` and `R&D` survive), invalid code points become
 * U+FFFD rather than control characters.
 */
function decodeEntities(s) {
  if (s.indexOf('&') === -1) return s;
  const n = s.length;
  let out = '';
  let i = 0;
  while (i < n) {
    const amp = s.indexOf('&', i);
    if (amp === -1) {
      out += s.slice(i);
      break;
    }
    out += s.slice(i, amp);
    let j = amp + 1;
    if (s.charCodeAt(j) === 35 /* # */) {
      j++;
      let hex = false;
      if (s[j] === 'x' || s[j] === 'X') {
        hex = true;
        j++;
      }
      const start = j;
      while (j < n && (hex ? isHex(s.charCodeAt(j)) : isDigit(s.charCodeAt(j)))) j++;
      if (j === start) {
        out += '&';
        i = amp + 1;
        continue;
      }
      const digits = s.slice(start, j);
      let cp = digits.length > 8 ? 0x110000 : parseInt(digits, hex ? 16 : 10);
      if (cp === 0 || cp > 0x10ffff || (cp >= 0xd800 && cp <= 0xdfff)) cp = 0xfffd;
      out += String.fromCodePoint(cp);
      if (s.charCodeAt(j) === 59 /* ; */) j++;
      i = j;
      continue;
    }
    const start = j;
    while (j < n && j - start < 32 && isAlnum(s.charCodeAt(j))) j++;
    const name = s.slice(start, j);
    if (name && s.charCodeAt(j) === 59 && Object.prototype.hasOwnProperty.call(NAMED_ENTITIES, name)) {
      out += NAMED_ENTITIES[name];
      i = j + 1;
    } else if (name && LEGACY_ENTITIES.has(name)) {
      out += NAMED_ENTITIES[name];
      i = j;
    } else {
      out += '&';
      i = amp + 1;
    }
  }
  return out;
}

/** Remove CSS comments without a lazy regex (unterminated `/*` is O(n)). */
function stripCssComments(s) {
  if (s.indexOf('/*') === -1) return s;
  let out = '';
  let i = 0;
  while (i < s.length) {
    const open = s.indexOf('/*', i);
    if (open === -1) {
      out += s.slice(i);
      break;
    }
    out += s.slice(i, open);
    const close = s.indexOf('*/', open + 2);
    if (close === -1) break;
    i = close + 2;
  }
  return out;
}

function numericCssValues(css, prop) {
  // css is lowercase, whitespace-free; prop is a fixed literal.
  const re = new RegExp(`(?:^|;)${prop}:([-+]?[0-9.]+)([a-z%]*)`, 'g');
  const found = [];
  let m;
  while ((m = re.exec(css)) !== null) {
    found.push({ value: parseFloat(m[1]), unit: m[2] });
  }
  return found;
}

/** Colours a reader cannot tell from the page (Azure DevOps renders on white), plus a few for equality checks. */
const NAMED_COLORS = {
  white: [255, 255, 255],
  snow: [255, 250, 250],
  ghostwhite: [248, 248, 255],
  whitesmoke: [245, 245, 245],
  mintcream: [245, 255, 250],
  black: [0, 0, 0],
  red: [255, 0, 0],
  lime: [0, 255, 0],
  green: [0, 128, 0],
  blue: [0, 0, 255],
  yellow: [255, 255, 0],
  gray: [128, 128, 128],
  grey: [128, 128, 128],
  silver: [192, 192, 192],
};
/** Every channel at or above this reads as white on a white page. */
const NEAR_WHITE = 245;
/** Two colours this close per channel are the same to a reader. */
const SAME_COLOR_DELTA = 8;
/** Offsets at least this far off-screen hide the text. */
const OFFSCREEN_PX = 1000;
const OFFSCREEN_EM = 60;

function clampByte(n) {
  return Math.max(0, Math.min(255, n));
}

/** CSS number or percentage → number; `scale` maps 100% to `scale` (255 for rgb, 1 for alpha). */
function cssNumber(token, scale) {
  const m = /^([-+]?(?:[0-9]+(?:\.[0-9]*)?|\.[0-9]+)(?:e[-+]?[0-9]+)?)(%|deg|rad|turn|grad)?$/.exec(String(token || ''));
  if (!m) return null;
  const value = parseFloat(m[1]);
  if (!Number.isFinite(value)) return null;
  return m[2] === '%' ? (value / 100) * scale : value;
}

function hslToRgb(h, s, l) {
  const hue = (((h % 360) + 360) % 360) / 360;
  if (s === 0) return [l * 255, l * 255, l * 255];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const channel = (t0) => {
    let t = t0;
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return [channel(hue + 1 / 3) * 255, channel(hue) * 255, channel(hue - 1 / 3) * 255];
}

/**
 * A CSS colour (lowercase) → { r, g, b, a }, or null when it is not one this
 * converter understands (`currentcolor`, `var(...)`, an unknown name). Hex,
 * rgb()/rgba()/hsl()/hsla() in comma or space syntax with `/ alpha`, and the
 * names above. `bareHex` accepts `fff` / `ffffff` without `#` (the legacy
 * `<font color>` attribute).
 */
function parseColor(raw, { bareHex = false } = {}) {
  const text = String(raw || '').trim().toLowerCase();
  if (!text) return null;
  if (text === 'transparent') return {
    r: 0, g: 0, b: 0, a: 0,
  };
  if (Object.prototype.hasOwnProperty.call(NAMED_COLORS, text)) {
    const [r, g, b] = NAMED_COLORS[text];
    return {
      r, g, b, a: 1,
    };
  }
  const hex = (bareHex ? /^#?([0-9a-f]+)$/ : /^#([0-9a-f]+)$/).exec(text);
  if (hex) {
    let digits = hex[1];
    if (digits.length === 3 || digits.length === 4) digits = digits.split('').map((d) => d + d).join('');
    if (digits.length !== 6 && digits.length !== 8) return null;
    return {
      r: parseInt(digits.slice(0, 2), 16),
      g: parseInt(digits.slice(2, 4), 16),
      b: parseInt(digits.slice(4, 6), 16),
      a: digits.length === 8 ? parseInt(digits.slice(6, 8), 16) / 255 : 1,
    };
  }
  const fn = /^(rgba?|hsla?)\(([^()]*)\)$/.exec(text);
  if (!fn) return null;
  const [main, alphaPart] = fn[2].split('/');
  const args = main.split(/[\s,]+/).filter(Boolean);
  if (args.length < 3) return null;
  let alpha = 1;
  const alphaToken = alphaPart !== undefined ? alphaPart.trim() : args[3];
  if (alphaToken !== undefined) {
    alpha = cssNumber(alphaToken, 1);
    if (alpha === null) return null;
  }
  let rgb;
  if (fn[1].startsWith('rgb')) {
    rgb = args.slice(0, 3).map((arg) => cssNumber(arg, 255));
  } else {
    const h = cssNumber(args[0].replace(/deg$/, ''), 360);
    const sat = cssNumber(args[1], 1);
    const light = cssNumber(args[2], 1);
    if (h === null || sat === null || light === null) return null;
    rgb = hslToRgb(h, Math.max(0, Math.min(1, sat)), Math.max(0, Math.min(1, light)));
  }
  if (rgb.some((c) => c === null)) return null;
  return {
    r: clampByte(rgb[0]), g: clampByte(rgb[1]), b: clampByte(rgb[2]), a: Math.max(0, Math.min(1, alpha)),
  };
}

function isNearWhite(color) {
  return Boolean(color) && color.r >= NEAR_WHITE && color.g >= NEAR_WHITE && color.b >= NEAR_WHITE;
}

function isClear(color) {
  return Boolean(color) && !(color.a > 0.05);
}

function sameColor(a, b) {
  return Boolean(a && b)
    && Math.abs(a.r - b.r) <= SAME_COLOR_DELTA
    && Math.abs(a.g - b.g) <= SAME_COLOR_DELTA
    && Math.abs(a.b - b.b) <= SAME_COLOR_DELTA;
}

/**
 * Inline style → Map(property → [values]). Lowercase, comments and `\`
 * escapes removed, `!important` dropped, whitespace inside a value folded to
 * one space (space-separated colour syntax needs it). One pass over the
 * string, so linear in its length.
 */
function cssDeclarations(style) {
  const css = stripCssComments(String(style).toLowerCase()).replace(/\\/g, '');
  const decls = new Map();
  for (const part of css.split(';')) {
    const colon = part.indexOf(':');
    if (colon === -1) continue;
    const prop = part.slice(0, colon).replace(/\s+/g, '');
    const value = part.slice(colon + 1).replace(/!\s*important/g, '').replace(/\s+/g, ' ').trim();
    if (!prop || !value) continue;
    if (!decls.has(prop)) decls.set(prop, []);
    decls.get(prop).push(value);
  }
  return decls;
}

/** A length → px for the off-screen tests (em/rem scaled to OFFSCREEN_PX / OFFSCREEN_EM). */
function offscreenLength(value) {
  const m = /^([-+]?(?:[0-9]+(?:\.[0-9]*)?|\.[0-9]+)(?:e[-+]?[0-9]+)?)(px|em|rem|vw|vh|pt|cm|in)?$/.exec(value);
  if (!m) return null;
  const n = parseFloat(m[1]);
  if (!Number.isFinite(n)) return null;
  const unit = m[2] || 'px';
  if (unit === 'em' || unit === 'rem') return (n / OFFSCREEN_EM) * OFFSCREEN_PX;
  if (unit === 'vw' || unit === 'vh') return (n / 100) * OFFSCREEN_PX;
  if (unit === 'in') return n * 96;
  if (unit === 'cm') return n * 37.8;
  if (unit === 'pt') return n * (4 / 3);
  return n;
}

function isZeroLength(value) {
  return /^[-+]?(?:0+(?:\.0*)?|\.0+)[a-z%]*$/.test(value);
}

/** Background colour an element declares itself, or null (inherited / none / an image). */
function declaredBackground(decls) {
  for (const prop of ['background-color', 'background']) {
    const values = decls.get(prop) || [];
    for (let i = values.length - 1; i >= 0; i -= 1) {
      const tokens = values[i].match(/(?:rgba?|hsla?)\([^()]*\)|[^\s]+/g) || [];
      for (const token of tokens) {
        const color = parseColor(token);
        if (color) return color;
      }
    }
  }
  return null;
}

/** Declaration-level rules: colour, clip, transform, zero boxes, off-screen offsets. */
function hiddenByDeclarations(decls) {
  const background = declaredBackground(decls);
  const opaqueBackground = background && !isClear(background) ? background : null;
  for (const prop of ['color', '-webkit-text-fill-color']) {
    for (const value of decls.get(prop) || []) {
      const color = parseColor(value);
      if (!color) continue;
      if (isClear(color)) return true;
      // Azure DevOps renders the field on white: white text is invisible
      // unless the element paints its own, different background.
      if (isNearWhite(color) && (!opaqueBackground || isNearWhite(opaqueBackground))) return true;
      if (opaqueBackground && sameColor(color, opaqueBackground)) return true;
    }
  }
  for (const value of decls.get('clip-path') || []) {
    if (/^(?:circle|ellipse)\(\s*(?:0+(?:\.0*)?|\.0+)(?:[a-z%]*)?(?:[\s)]|$)/.test(value)) return true;
    const inset = /^inset\(\s*([0-9.]+)%/.exec(value);
    if (inset && parseFloat(inset[1]) >= 50) return true;
  }
  for (const value of decls.get('clip') || []) {
    const rect = /^rect\(([^()]*)\)$/.exec(value);
    if (!rect) continue;
    const parts = rect[1].split(/[\s,]+/).filter(Boolean).map((p) => offscreenLength(p));
    if (parts.length === 4 && parts.every((p) => p !== null) && (parts[2] <= parts[0] || parts[1] <= parts[3])) return true;
  }
  for (const value of [...(decls.get('transform') || []), ...(decls.get('translate') || []).map((v) => `translate(${v})`),
    ...(decls.get('scale') || []).map((v) => `scale(${v})`)]) {
    const re = /(translate(?:x|y|z|3d)?|scale(?:x|y|z|3d)?)\(([^()]*)\)/g;
    let m;
    while ((m = re.exec(value)) !== null) {
      const args = m[2].split(/[\s,]+/).filter(Boolean);
      if (m[1].startsWith('scale')) {
        if (args.some((arg) => { const n = cssNumber(arg, 1); return n !== null && Math.abs(n) < 0.01; })) return true;
      } else if (args.some((arg) => { const px = offscreenLength(arg); return px !== null && Math.abs(px) >= OFFSCREEN_PX; })) {
        return true;
      }
    }
  }
  const clipsOverflow = (decls.get('overflow') || []).concat(decls.get('overflow-x') || [], decls.get('overflow-y') || [])
    .some((v) => /^(?:hidden|clip)(?:\s|$)/.test(v));
  if (clipsOverflow) {
    for (const prop of ['width', 'height', 'max-width', 'max-height', 'line-height']) {
      if ((decls.get(prop) || []).some(isZeroLength)) return true;
    }
  }
  for (const value of decls.get('font-size') || []) {
    if (isZeroLength(value)) return true;
    if (/^calc\(\s*[-+]?(?:0+(?:\.0*)?|\.0+)(?![0-9.])/.test(value) || /\*\s*(?:0+(?:\.0*)?|\.0+)(?![0-9.])/.test(value)) return true;
  }
  // `font: 0/0 a` is the classic image-replacement hide.
  for (const value of decls.get('font') || []) {
    if (/(?:^|\s)[-+]?(?:0+(?:\.0*)?|\.0+)(?:px|em|rem|pt|%)?(?:\/|\s|$)/.test(value)) return true;
  }
  for (const prop of ['left', 'top', 'right', 'bottom', 'inset', 'inset-inline-start', 'inset-block-start',
    'text-indent', 'margin-left', 'margin-top']) {
    for (const value of decls.get(prop) || []) {
      const px = offscreenLength(value.split(' ')[0]);
      if (px !== null && px <= -OFFSCREEN_PX) return true;
    }
  }
  return false;
}

/**
 * Inline styles that make text invisible to a human reader. Errs toward
 * "hidden": a false positive only routes text to the hidden channel.
 */
function isHiddenStyle(style) {
  const css = stripCssComments(String(style).toLowerCase()).replace(/[\s\\]+/g, '');
  if (!css) return false;
  if (/(?:^|;)display:none(?:;|!|$)/.test(css)) return true;
  if (/(?:^|;)visibility:(?:hidden|collapse)(?:;|!|$)/.test(css)) return true;
  if (/(?:^|;)(?:color|-webkit-text-fill-color):transparent(?:;|!|$)/.test(css)) return true;
  if (/(?:^|;)content-visibility:hidden(?:;|!|$)/.test(css)) return true;
  if (/(?:^|;)transform:scale[xy]?\(0(?:\.0*)?[,)]/.test(css)) return true;
  if (/(?:^|;)clip:rect\(0[a-z]*,?0[a-z]*,?0[a-z]*,?0[a-z]*\)/.test(css)) return true;
  if (/(?:^|;)clip-path:inset\((?:50|100)%\)/.test(css)) return true;
  if (/(?:^|;)(?:text-indent|left|top|right|margin-left|margin-top):-[0-9]{3,}/.test(css)) return true;
  for (const { value } of numericCssValues(css, 'opacity')) {
    if (!(value > 0.05)) return true;
  }
  for (const { value, unit } of numericCssValues(css, 'font-size')) {
    if (!(value > 0)) return true;
    if ((unit === 'em' || unit === 'rem') && value < 0.2) return true;
    if ((unit === '%') && value < 20) return true;
    if ((unit === '' || unit === 'px' || unit === 'pt') && value < 2) return true;
  }
  if (/(?:^|;)overflow:hidden(?:;|!|$)/.test(css)) {
    for (const prop of ['height', 'max-height', 'width', 'max-width']) {
      for (const { value } of numericCssValues(css, prop)) {
        if (!(value > 0)) return true;
      }
    }
  }
  return hiddenByDeclarations(cssDeclarations(style));
}

/** `<font color>` that a reader cannot see on Azure DevOps' white page. */
function isHiddenFontColor(value) {
  const color = parseColor(value, { bareHex: true });
  return Boolean(color) && (isClear(color) || isNearWhite(color));
}

/** http/https/mailto only; browsers ignore C0 controls and spaces in schemes. */
function safeHref(href) {
  if (typeof href !== 'string') return null;
  const cleaned = href.replace(/[\u0000- \u007f-\u009f]+/g, '');
  if (!/^(?:https?:|mailto:)/i.test(cleaned)) return null;
  return cleaned.replace(/[()<>]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
}

function collapseWs(s) {
  return s.replace(/[ \t\n\r\f]+/g, ' ');
}

/**
 * Line-wise cleanup without regexes over unbounded whitespace runs: trim
 * every line, cap blank-line runs at one (zero when `squash`), drop leading
 * and trailing blank lines.
 */
function cleanLines(s, squash) {
  if (s.indexOf('\n') === -1) return s.trim();
  const lines = s.split('\n');
  const out = [];
  let blank = false;
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      blank = out.length > 0;
      continue;
    }
    if (blank && !squash) out.push('');
    blank = false;
    out.push(line);
  }
  return out.join('\n');
}

function oneLine(s) {
  if (s.indexOf('\n') === -1) return s.trim();
  return s.split('\n').map((l) => l.trim()).filter(Boolean).join(' ');
}

function longestRun(s, ch) {
  let best = 0;
  let cur = 0;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === ch) {
      cur++;
      if (cur > best) best = cur;
    } else {
      cur = 0;
    }
  }
  return best;
}

/* ------------------------------------------------------------------------ */
/* Tokenizer + tree builder                                                 */
/* ------------------------------------------------------------------------ */

/** Shared, never-mutated attribute containers for attribute-less tags. */
const NO_ATTRS = new Map();
const NO_ATTR_LIST = [];

/**
 * Parse a tag starting at `i` (src[i] is the first char of the name). Returns
 * { name, attrs: Map (first value wins, as browsers do), all: [[k,v]...],
 * end } or null when the input ends inside the tag (browsers drop it).
 * Quoted attribute values may contain `>`.
 */
function parseTag(src, i) {
  const n = src.length;
  let j = i;
  while (j < n) {
    const c = src.charCodeAt(j);
    if (isWs(c) || c === 47 /* / */ || c === 62 /* > */) break;
    j++;
  }
  const name = src.slice(i, j).toLowerCase();
  let attrs = NO_ATTRS;
  let all = NO_ATTR_LIST;
  for (;;) {
    while (j < n && (isWs(src.charCodeAt(j)) || src.charCodeAt(j) === 47)) j++;
    if (j >= n) return null;
    if (src.charCodeAt(j) === 62) return { name, attrs, all, end: j + 1 };
    if (attrs === NO_ATTRS) {
      attrs = new Map();
      all = [];
    }
    const as = j;
    if (src.charCodeAt(j) === 61 /* = */) j++; // spec: '=' may start a name
    while (j < n) {
      const c = src.charCodeAt(j);
      if (isWs(c) || c === 47 || c === 62 || c === 61) break;
      j++;
    }
    const aname = src.slice(as, j).toLowerCase();
    while (j < n && isWs(src.charCodeAt(j))) j++;
    let value = '';
    if (src.charCodeAt(j) === 61) {
      j++;
      while (j < n && isWs(src.charCodeAt(j))) j++;
      const q = src[j];
      if (q === '"' || q === "'") {
        const close = src.indexOf(q, j + 1);
        if (close === -1) return null;
        value = src.slice(j + 1, close);
        j = close + 1;
      } else {
        const vs = j;
        while (j < n && !isWs(src.charCodeAt(j)) && src.charCodeAt(j) !== 62) j++;
        value = src.slice(vs, j);
      }
      value = decodeEntities(value);
    }
    all.push([aname, value]);
    if (!attrs.has(aname)) attrs.set(aname, value);
  }
}

/** Index of `</name` (case-insensitive, followed by a delimiter) or n. */
function findRawEnd(src, from, name) {
  const n = src.length;
  let p = from;
  for (;;) {
    p = src.indexOf('</', p);
    if (p === -1) return n;
    let k = 0;
    while (k < name.length && p + 2 + k < n && src[p + 2 + k].toLowerCase() === name[k]) k++;
    if (k === name.length) {
      const after = p + 2 + k;
      if (after >= n) return p;
      const c = src.charCodeAt(after);
      if (isWs(c) || c === 47 || c === 62) return p;
    }
    p += 2;
  }
}

function attrsHide(name, attrs) {
  if (attrs.has('hidden')) return true;
  const aria = attrs.get('aria-hidden');
  if (aria !== undefined && aria.trim().toLowerCase() === 'true') return true;
  const style = attrs.get('style');
  if (style && isHiddenStyle(style)) return true;
  if (name === 'font' && attrs.has('color') && isHiddenFontColor(attrs.get('color'))) return true;
  if (name === 'input' && (attrs.get('type') || '').trim().toLowerCase() === 'hidden') return true;
  return false;
}

function parse(src) {
  const n = src.length;
  const root = { name: '#root', attrs: new Map(), children: [] };
  const stack = [{ name: '#root', node: root, hidden: false, depth: 0 }];
  const segments = [];
  let run = null; // text of the hidden subtree currently open

  const top = () => stack[stack.length - 1];

  function addHidden(text) {
    if (text && text.trim()) segments.push(text);
  }

  function emitText(text) {
    if (!text) return;
    const t = top();
    if (t.hidden) {
      run.push(text);
      return;
    }
    const kids = t.node.children;
    const last = kids[kids.length - 1];
    if (last && last.text !== undefined) last.text += text;
    else kids.push({ text });
  }

  function popTo(index) {
    while (stack.length > index) {
      const e = stack.pop();
      if (e.hidden && !top().hidden) {
        addHidden(run.join(''));
        run = null;
      }
    }
  }

  function findOpen(names, stopAt) {
    const floor = Math.max(1, stack.length - STACK_SEARCH_LIMIT);
    for (let k = stack.length - 1; k >= floor; k--) {
      const nm = stack[k].name;
      if (names.has(nm)) return k;
      if (stopAt && stopAt.has(nm)) return -1;
    }
    return -1;
  }

  function findOpenName(name) {
    const floor = Math.max(1, stack.length - STACK_SEARCH_LIMIT);
    for (let k = stack.length - 1; k >= floor; k--) {
      if (stack[k].name === name) return k;
    }
    return -1;
  }

  function closeP() {
    const floor = Math.max(1, stack.length - STACK_SEARCH_LIMIT);
    for (let k = stack.length - 1; k >= floor; k--) {
      const nm = stack[k].name;
      if (nm === 'p') {
        popTo(k);
        return;
      }
      if (!PHRASING.has(nm)) return;
    }
  }

  function implicitCloses(name) {
    let k = -1;
    if (name === 'li') k = findOpen(ONE_LI, LIST_SCOPE);
    else if (name === 'dt' || name === 'dd') k = findOpen(DT_DD, DL_SCOPE);
    else if (name === 'td' || name === 'th') k = findOpen(TD_TH, CELL_SCOPE);
    else if (name === 'tr') k = findOpen(ONE_TR, ROW_SCOPE);
    else if (TSECTIONS.has(name)) k = findOpen(TSECTIONS, SECTION_SCOPE);
    // Nested <a> is deliberately NOT implicitly closed: the browser's
    // adoption-agency repair can keep a hidden ancestor open, and closing
    // early here could move hidden text into the visible channel.
    if (k > 0) popTo(k);
    if (CLOSES_P.has(name) || name === 'li' || name === 'dt' || name === 'dd') closeP();
    if (HEADINGS.has(name) && HEADINGS.has(top().name)) popTo(stack.length - 1);
  }

  function startElement(name, attrs, all) {
    implicitCloses(name);
    const parent = top();
    for (const [k, v] of all) {
      if (HIDDEN_ATTRS.has(k) || k.startsWith('data-') || (k === 'value' && name === 'input')) addHidden(v);
      if ((k === 'href' || k === 'src' || k === 'action' || k === 'formaction') && v && !safeHref(v)
        && /^\s*[a-z][a-z0-9+.-]*:/i.test(v) && !/^\s*(?:https?|mailto):/i.test(v)) {
        // Dropped non-web URL (javascript:, data:, vbscript:...): not visible
        // text, but its payload is content the scanner must see.
        addHidden(v);
      }
    }
    const hidden = parent.hidden || HIDDEN_TAGS.has(name) || attrsHide(name, attrs);
    if (hidden && run && BLOCK_TAGS.has(name)) run.push('\n');
    let node = parent.node;
    let depth = parent.depth;
    if (!hidden && depth < MAX_NODE_DEPTH) {
      node = { name, attrs, children: [] };
      parent.node.children.push(node);
      depth++;
    }
    if (VOID_TAGS.has(name)) {
      if (hidden && name === 'br') {
        if (parent.hidden) run.push('\n');
      }
      return;
    }
    stack.push({ name, node, hidden, depth });
    if (hidden && !parent.hidden) run = [];
  }

  function endElement(name) {
    if (name === 'br') {
      startElement('br', NO_ATTRS, NO_ATTR_LIST);
      return;
    }
    const k = HEADINGS.has(name) ? findOpen(HEADINGS, null) : findOpenName(name);
    if (k > 0) {
      if (top().hidden && run && BLOCK_TAGS.has(name)) run.push('\n');
      popTo(k);
    }
  }

  let bangCloseCache = -2; // memoised indexOf('--!>') so repeated comments stay linear
  function commentEnd(from) {
    const dash = src.indexOf('-->', from);
    if (bangCloseCache !== -1 && bangCloseCache < from) bangCloseCache = src.indexOf('--!>', from);
    const bang = bangCloseCache;
    if (dash === -1 && bang === -1) return { contentEnd: n, next: n };
    if (bang !== -1 && (dash === -1 || bang < dash)) return { contentEnd: bang, next: bang + 4 };
    return { contentEnd: dash, next: dash + 3 };
  }

  let i = 0;
  while (i < n) {
    const lt = src.indexOf('<', i);
    if (lt !== i) {
      const end = lt === -1 ? n : lt;
      emitText(decodeEntities(src.slice(i, end)));
      i = end;
      continue;
    }
    const c1 = src.charCodeAt(i + 1);
    if (c1 === 33 /* ! */) {
      if (src.startsWith('<!--', i)) {
        if (src.startsWith('<!-->', i)) { i += 5; continue; }
        if (src.startsWith('<!--->', i)) { i += 6; continue; }
        const { contentEnd, next } = commentEnd(i + 4);
        addHidden(src.slice(i + 4, contentEnd));
        i = next;
        continue;
      }
      // <!DOCTYPE>, <![CDATA[...]]>, other bogus comments: not rendered.
      const gt = src.indexOf('>', i + 2);
      const end = gt === -1 ? n : gt;
      const body = src.slice(i + 2, end);
      if (!/^doctype\b/i.test(body)) addHidden(body);
      i = gt === -1 ? n : gt + 1;
      continue;
    }
    if (c1 === 63 /* ? */) {
      const gt = src.indexOf('>', i + 2);
      addHidden(src.slice(i + 2, gt === -1 ? n : gt));
      i = gt === -1 ? n : gt + 1;
      continue;
    }
    if (c1 === 47 /* / */) {
      if (isAlpha(src.charCodeAt(i + 2))) {
        const tag = parseTag(src, i + 2);
        if (!tag) {
          addHidden(src.slice(i));
          break;
        }
        endElement(tag.name);
        i = tag.end;
        continue;
      }
      if (src.charCodeAt(i + 2) === 62) { i += 3; continue; } // `</>` is ignored
      if (i + 2 >= n) { emitText('</'); break; }
      const gt = src.indexOf('>', i + 2);
      addHidden(src.slice(i + 2, gt === -1 ? n : gt));
      i = gt === -1 ? n : gt + 1;
      continue;
    }
    if (isAlpha(c1)) {
      const tag = parseTag(src, i + 1);
      if (!tag) {
        // EOF inside a tag: browsers render nothing, so neither do we.
        addHidden(src.slice(i));
        break;
      }
      startElement(tag.name, tag.attrs, tag.all);
      i = tag.end;
      if (RAW_TEXT_TAGS.has(tag.name)) {
        const end = findRawEnd(src, i, tag.name);
        const raw = src.slice(i, end);
        emitText(RCDATA_TAGS.has(tag.name) ? decodeEntities(raw) : raw);
        i = end; // the end tag (if any) is handled by the main loop
      }
      continue;
    }
    emitText('<'); // stray `<` (e.g. `a < b`) is text
    i++;
  }
  popTo(1);
  if (run) addHidden(run.join(''));
  return { root, segments };
}

/* ------------------------------------------------------------------------ */
/* Renderer                                                                 */
/* ------------------------------------------------------------------------ */

function rawText(node, out) {
  for (const c of node.children) {
    if (c.text !== undefined) out.push(c.text);
    else if (c.name === 'br') out.push('\n');
    else rawText(c, out);
  }
  return out;
}

/**
 * PATH_RE in sufficiency.js only accepts a path delimited by whitespace,
 * quotes, backticks or parens. `**coding-loop/run.js**` or `_src/x.py_` would
 * corrupt or hide the path, so path-like text is left unwrapped.
 */
const PATH_LIKE_RE = /[/\\]|\w\.\w/;

function wrapInline(inner, marker) {
  const core = inner.trim();
  if (!core || core.includes('\n\n') || PATH_LIKE_RE.test(core)) return inner;
  const lead = inner.slice(0, inner.length - inner.trimStart().length);
  const trail = inner.slice(inner.trimEnd().length);
  return `${lead}${marker}${core}${marker}${trail}`;
}

function renderChildren(node, ctx) {
  let out = '';
  for (const c of node.children) {
    let piece = c.text !== undefined ? collapseWs(c.text) : renderEl(c, ctx);
    // Whitespace collapsing spans element boundaries (`a <b> b</b>`).
    if (piece.charCodeAt(0) === 32 && out.charCodeAt(out.length - 1) === 32) piece = piece.slice(1);
    out += piece;
  }
  return out;
}

function renderPre(el, ctx) {
  let content = rawText(el, []).join('');
  if (content.startsWith('\r\n')) content = content.slice(2);
  else if (content.startsWith('\n')) content = content.slice(1);
  content = content.replace(/\r\n?/g, '\n');
  while (content.endsWith('\n')) content = content.slice(0, -1);
  let lang = '';
  const classes = [el.attrs.get('class') || ''];
  for (const c of el.children) if (c.name === 'code') classes.push(c.attrs.get('class') || '');
  for (const cls of classes) {
    const m = /(?:^|\s)lang(?:uage)?-([A-Za-z0-9_+-]{1,32})(?:\s|$)/.exec(cls);
    if (m) {
      lang = m[1];
      break;
    }
  }
  const fence = '`'.repeat(Math.max(3, longestRun(content, '`') + 1));
  const idx = ctx.pres.push(`${fence}${lang}\n${content}\n${fence}`) - 1;
  return `\n\n${PH}P${idx}${PH}\n\n`;
}

function renderCode(el) {
  const text = collapseWs(rawText(el, []).join(''));
  if (!text.trim()) return text;
  const ticks = '`'.repeat(longestRun(text, '`') + 1);
  const pad = text.startsWith('`') || text.endsWith('`') ? ' ' : '';
  return `${ticks}${pad}${text}${pad}${ticks}`;
}

function renderList(el, ctx) {
  const ordered = el.name === 'ol';
  let num = ordered ? parseInt(el.attrs.get('start'), 10) : 0;
  if (!Number.isFinite(num)) num = 1;
  const inner = { ...ctx, listDepth: ctx.listDepth + 1 };
  const lines = [];
  for (const c of el.children) {
    if (c.text !== undefined) {
      if (c.text.trim()) lines.push(collapseWs(c.text).trim());
      continue;
    }
    if (c.name !== 'li') {
      const body = cleanLines(renderEl(c, inner), true);
      if (body) lines.push(body);
      continue;
    }
    lines.push(renderItem(c, ordered ? `${num++}. ` : '- ', inner));
  }
  return `\n\n${lines.join('\n')}\n\n`;
}

function renderItem(li, marker, ctx) {
  const body = cleanLines(renderChildren(li, ctx), true);
  const parts = body.split('\n');
  const indent = ctx.listDepth <= MAX_INDENT_DEPTH ? IND.repeat(marker.length) : '';
  return [marker + parts[0], ...parts.slice(1).map((l) => indent + l)].join('\n');
}

function renderTable(el, ctx) {
  const rows = [];
  const collect = (node) => {
    for (const c of node.children) {
      if (c.text !== undefined) continue;
      if (c.name === 'tr') rows.push(c);
      else if (TSECTIONS.has(c.name)) collect(c);
    }
  };
  collect(el);
  if (!rows.length) return `\n\n${renderChildren(el, ctx)}\n\n`;
  const grid = rows.map((tr) => tr.children
    .filter((c) => c.text === undefined && TD_TH.has(c.name))
    .map((cell) => oneLine(cleanLines(renderChildren(cell, ctx), true)).replace(/\|/g, '\\|')));
  const cols = grid.reduce((m, r) => Math.max(m, r.length), 1);
  const line = (r) => {
    let row = '|';
    for (let k = 0; k < cols; k++) row += ` ${r[k] || ''} |`;
    return row;
  };
  const out = [line(grid[0]), `| ${Array(cols).fill('---').join(' | ')} |`];
  for (const r of grid.slice(1)) out.push(line(r));
  let caption = '';
  for (const c of el.children) {
    if (c.name === 'caption') caption = oneLine(renderChildren(c, ctx));
  }
  return `\n\n${caption ? `${caption}\n\n` : ''}${out.join('\n')}\n\n`;
}

const WRAPPERS = new Set([
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'strong', 'b', 'em', 'i', 'a', 'ul', 'ol',
  'menu', 'dir', 'li', 'blockquote', 'table',
]);

function renderEl(el, parentCtx) {
  const { name } = el;
  let ctx = parentCtx;
  if (WRAPPERS.has(name)) {
    if (parentCtx.wrap >= MAX_WRAP_DEPTH) {
      const plain = renderChildren(el, parentCtx);
      return name === 'strong' || name === 'b' || name === 'em' || name === 'i' || name === 'a'
        ? plain : `\n\n${plain}\n\n`;
    }
    ctx = { ...parentCtx, wrap: parentCtx.wrap + 1 };
  }
  if (HEADINGS.has(name)) {
    const text = oneLine(renderChildren(el, ctx));
    return text ? `\n\n${'#'.repeat(Number(name[1]))} ${text}\n\n` : '';
  }
  switch (name) {
    case 'br':
      return '\n';
    case 'hr':
      return '\n\n---\n\n';
    case 'strong':
    case 'b':
      return wrapInline(renderChildren(el, ctx), '**');
    case 'em':
    case 'i':
      return wrapInline(renderChildren(el, ctx), '_');
    case 'code':
    case 'kbd':
    case 'samp':
    case 'tt':
      return renderCode(el);
    case 'pre':
    case 'listing':
      return renderPre(el, ctx);
    case 'a': {
      const inner = renderChildren(el, ctx);
      const href = safeHref(el.attrs.get('href'));
      if (!href) return inner;
      const text = oneLine(inner);
      if (!text) return href;
      const lead = /^\s/.test(inner) ? ' ' : '';
      const trail = /\s$/.test(inner) ? ' ' : '';
      // `[coding-loop/run.js](...)` hides the path from PATH_RE; keep the
      // text bare and append the URL instead.
      if (text !== href && PATH_LIKE_RE.test(text) && !/^(?:https?|mailto):/i.test(text)) {
        return `${lead}${text} (${href})${trail}`;
      }
      return `${lead}[${text}](${href})${trail}`;
    }
    case 'img': {
      const alt = el.attrs.get('alt');
      const text = alt ? oneLine(collapseWs(alt)) : '';
      return text ? `[${text}]` : '';
    }
    case 'ul':
    case 'ol':
    case 'menu':
    case 'dir':
      return renderList(el, ctx);
    case 'li':
      return `\n\n${renderItem(el, '- ', { ...ctx, listDepth: ctx.listDepth + 1 })}\n\n`;
    case 'blockquote': {
      const body = cleanLines(renderChildren(el, { ...ctx, quoteDepth: ctx.quoteDepth + 1 }), false);
      if (!body) return '';
      if (ctx.quoteDepth >= MAX_INDENT_DEPTH) return `\n\n${body}\n\n`;
      return `\n\n${body.split('\n').map((l) => (l ? `> ${l}` : '>')).join('\n')}\n\n`;
    }
    case 'table':
      return renderTable(el, ctx);
    case 'td':
    case 'th':
      return `${renderChildren(el, ctx)} `;
    case 'input':
    case 'select':
    case 'option':
    case 'button':
      return name === 'input' ? '' : renderChildren(el, ctx);
    default:
      if (BLOCK_TAGS.has(name)) return `\n\n${renderChildren(el, ctx)}\n\n`;
      return renderChildren(el, ctx);
  }
}

function expandPlaceholders(text, pres) {
  if (text.indexOf(PH) === -1) return text;
  return text.split('\n').map((line) => {
    const at = line.indexOf(`${PH}P`);
    if (at === -1) return line;
    const close = line.indexOf(PH, at + 2);
    const idx = Number(line.slice(at + 2, close));
    const block = pres[idx];
    if (close === -1 || block === undefined) return line;
    const prefix = line.slice(0, at);
    const rest = prefix.replace(/[^ >]/g, ' ');
    const blockLines = block.split('\n');
    return [prefix + blockLines[0], ...blockLines.slice(1).map((l) => rest + l)].join('\n')
      + line.slice(close + 1);
  }).join('\n');
}

/* ------------------------------------------------------------------------ */
/* Public API                                                               */
/* ------------------------------------------------------------------------ */

/**
 * Convert an HTML field to markdown plus the hidden-content channel.
 * @param {string} html
 * @param {{ maxLength?: number }} [options]
 * @returns {{ markdown: string, hidden: string, truncated: boolean }}
 */
function htmlToMarkdown(html, { maxLength = DEFAULT_MAX_LENGTH } = {}) {
  let src = html === null || html === undefined ? '' : String(html);
  const cap = Number.isFinite(maxLength) && maxLength >= 0 ? Math.floor(maxLength) : DEFAULT_MAX_LENGTH;
  const truncated = src.length > cap;
  if (truncated) src = src.slice(0, cap);
  // Field content must not be able to forge internal markers.
  src = src.replace(/[\u0000\u0001]/g, '�');

  const { root, segments } = parse(src);
  const ctx = { pres: [], listDepth: 0, quoteDepth: 0, wrap: 0 };
  let markdown = cleanLines(renderChildren(root, ctx), false);
  markdown = markdown.split(IND).join(' ');
  markdown = expandPlaceholders(markdown, ctx.pres);
  markdown = markdown.split(' ').join(' ');

  const hidden = segments
    .map((s) => s.replace(/[\s ]+/g, ' ').trim())
    .filter(Boolean)
    .join('\n');

  return { markdown, hidden, truncated };
}

const LIKELY_HTML_TAGS = new Set([
  'p', 'div', 'br', 'span', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'strong', 'b', 'em', 'i', 'u', 's', 'code', 'pre', 'a', 'img', 'table', 'thead',
  'tbody', 'tr', 'td', 'th', 'blockquote', 'hr', 'font', 'del', 'sup', 'sub',
  'html', 'body', 'section', 'article', 'script', 'style', 'template', 'noscript',
  'iframe', 'dl', 'dt', 'dd', 'details', 'summary', 'input', 'label',
]);

/**
 * True when the text contains a recognisable HTML tag, so callers can pass
 * markdown fields through unchanged. Linear scan: each `<` inspects at most a
 * short tag name.
 */
function isLikelyHtml(text) {
  if (typeof text !== 'string' || text.indexOf('<') === -1) return false;
  const n = text.length;
  let i = text.indexOf('<');
  while (i !== -1) {
    let j = i + 1;
    if (text.charCodeAt(j) === 47) j++;
    const start = j;
    while (j < n && j - start <= 12 && isAlnum(text.charCodeAt(j))) j++;
    if (j > start && j - start <= 12) {
      const name = text.slice(start, j).toLowerCase();
      const c = j < n ? text.charCodeAt(j) : -1;
      if (LIKELY_HTML_TAGS.has(name) && (c === 62 || c === 47 || isWs(c))) return true;
    }
    i = text.indexOf('<', i + 1);
  }
  return false;
}

/**
 * Hidden channel of the raw HTML embedded in a MARKDOWN field (GitHub issue
 * bodies, Azure DevOps markdown-format fields). Both renderers accept inline
 * HTML, so `<!-- ... -->`, `<div hidden>` or a `title=` attribute is
 * invisible to the person reading the issue but present in the text a model
 * is fed. The markdown itself is NOT rewritten (it stays the body); only the
 * hidden text is returned, so the caller can scan it.
 *
 * Errs toward more hidden text: HTML inside a code fence is visible on the
 * forge but is still reported here. Over-reporting only adds scan input.
 */
function hiddenInMarkdown(text, { maxLength = DEFAULT_MAX_LENGTH } = {}) {
  if (typeof text !== 'string' || text.indexOf('<') === -1) return '';
  return htmlToMarkdown(text, { maxLength }).hidden;
}

module.exports = {
  hiddenInMarkdown,
  htmlToMarkdown,
  isLikelyHtml,
  DEFAULT_MAX_LENGTH,
  // exported for tests
  decodeEntities,
  isHiddenStyle,
  parseColor,
  safeHref,
};
