import MarkdownIt from 'markdown-it';
import sanitizeHtml from 'sanitize-html';

import Token from 'markdown-it/lib/token.mjs';

const markdown = new MarkdownIt({ html: false, linkify: false });
markdown.renderer.rules.image = () => '';
// Parse unsafe destinations as links so the sanitizer can discard the href while retaining
// the human-readable label. Otherwise markdown-it emits the entire dangerous source as text.
markdown.validateLink = () => true;
const htmlDetector = new MarkdownIt({ html: true, linkify: false });
htmlDetector.validateLink = () => true;

type ParagraphTokens = { children: Token[]; sourceRange: string };

const paragraphs = (tokens: Token[]): ParagraphTokens[] => {
  let index = 0;
  const found: ParagraphTokens[] = [];
  if (tokens[index]?.type === 'heading_open' && tokens[index]?.tag === 'h1') index += 3;
  for (; index < tokens.length; index += 1) {
    if (tokens[index]?.type !== 'paragraph_open' || tokens[index]?.level !== 0) continue;
    const inline = tokens[index + 1];
    if (inline?.type === 'inline' && inline.children) {
      found.push({ children: inline.children, sourceRange: (inline.map ?? []).join(':') });
    }
  }
  return found;
};

const withoutRawHtml = (tokens: Token[]): Token[] => {
  let blockedTag: 'script' | 'style' | undefined;
  return tokens.filter((token) => {
    if (token.type !== 'html_inline') return blockedTag === undefined;
    const marker = token.content.trim().toLowerCase();
    if (blockedTag !== undefined) {
      if (marker.startsWith(`</${blockedTag}`)) blockedTag = undefined;
      return false;
    }
    if (marker.startsWith('<script') && ['>', ' ', '\t', '\n'].includes(marker[7] ?? '>')) blockedTag = 'script';
    if (marker.startsWith('<style') && ['>', ' ', '\t', '\n'].includes(marker[6] ?? '>')) blockedTag = 'style';
    return false;
  });
};

const visibleTokenText = (token: Token): string => {
  if (token.type === 'text' || token.type === 'code_inline') return token.content;
  if (token.type === 'softbreak' || token.type === 'hardbreak') return ' ';
  return '';
};

const normalizedInlineTokens = (tokens: Token[]): Token[] => {
  let hasText = false;
  let previousEndsInSpace = false;
  const normalized = tokens.map((token) => {
    const clone = new Token(token.type, token.tag, token.nesting);
    Object.assign(clone, token);
    if (token.type === 'image' || token.type === 'html_inline') {
      clone.content = '';
      clone.type = 'text';
      return clone;
    }
    const text = visibleTokenText(token);
    if (text === '') return clone;
    let content = text.replace(/\s+/gu, ' ');
    if (!hasText) content = content.trimStart();
    else if (previousEndsInSpace) content = content.trimStart();
    if (content !== '') {
      clone.content = content;
      hasText = true;
      previousEndsInSpace = content.endsWith(' ');
    } else {
      clone.content = '';
    }
    if (token.type === 'softbreak' || token.type === 'hardbreak') clone.type = 'text';
    return clone;
  });
  for (let index = normalized.length - 1; index >= 0; index -= 1) {
    const lastVisible = normalized[index];
    if (lastVisible && visibleTokenText(lastVisible) !== '') {
      lastVisible.content = lastVisible.content.trimEnd();
      break;
    }
  }
  return normalized;
};

export const truncateVisibleText = (value: string, maximum = 240): string => {
  const points = Array.from(value);
  if (points.length <= maximum) return value;
  if (maximum <= 0) return '';
  if (maximum === 1) return '…';
  const candidate = points.slice(0, maximum - 1).join('');
  const whitespace = [...candidate.matchAll(/\s/gu)].at(-1);
  const cut = whitespace === undefined ? candidate : candidate.slice(0, whitespace.index);
  return `${cut.trimEnd()}…`;
};

const truncateTokens = (tokens: Token[], maximum: number): Token[] => {
  const normalized = normalizedInlineTokens(tokens);
  const fullText = normalized.map(visibleTokenText).join('');
  const wanted = truncateVisibleText(fullText, maximum);
  if (wanted === fullText) return normalized;
  const target = Array.from(wanted.slice(0, -1));
  let remaining = target.length;
  let ellipsisWritten = false;
  return normalized.map((token) => {
    const clone = new Token(token.type, token.tag, token.nesting);
    Object.assign(clone, token);
    const text = visibleTokenText(token);
    if (text === '') return clone;
    const points = Array.from(text);
    if (remaining <= 0) {
      clone.content = ellipsisWritten ? '' : '…';
      clone.type = 'text';
      ellipsisWritten = true;
      return clone;
    }
    const used = points.slice(0, remaining).join('');
    remaining -= Array.from(used).length;
    clone.content = used + (remaining === 0 && !ellipsisWritten ? '…' : '');
    if (remaining === 0) ellipsisWritten = true;
    return clone;
  });
};

const safeExcerptHtml = (html: string): string => sanitizeHtml(html, {
  allowedTags: ['p', 'em', 'strong', 'code', 'a'],
  allowedAttributes: { a: ['href', 'rel'] },
  allowedSchemes: ['http', 'https'],
  allowedSchemesByTag: { a: ['http', 'https'] },
  allowProtocolRelative: false,
  transformTags: {
    a: (_tagName, attributes) => {
      const href = attributes.href;
      const external = href !== undefined && /^https?:\/\//iu.test(href);
      const attribs: Record<string, string> = {};
      if (href !== undefined) attribs.href = href;
      if (external) attribs.rel = 'noreferrer';
      return { tagName: 'a', attribs };
    },
  },
});

const escapeHtml = (value: string): string => value
  .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;').replaceAll("'", '&#39;');

export const visibleText = (html: string): string => markdown.utils.unescapeAll(
  sanitizeHtml(html, { allowedTags: [], allowedAttributes: {} }),
);

export function extractExcerptHtml(markdownSource: string, fallback: string, maximum = 240): string {
  const safeParagraphs = paragraphs(markdown.parse(markdownSource, {}));
  // A second tokenization only identifies raw HTML token boundaries. Source ranges align it with
  // the html:false parse, while rendering remains on the html:false parser/renderer.
  const detectedByRange = new Map(
    paragraphs(htmlDetector.parse(markdownSource, {}))
      .map((paragraph) => [paragraph.sourceRange, paragraph.children]),
  );
  for (const safeParagraph of safeParagraphs) {
    const detected = detectedByRange.get(safeParagraph.sourceRange);
    if (detected === undefined) continue;
    const sourceTokens = withoutRawHtml(detected);
    const retained = truncateTokens(sourceTokens, maximum);
    if (retained.map(visibleTokenText).join('').trim() !== '') {
      const rendered = `<p>${markdown.renderer.renderInline(retained, markdown.options, {})}</p>`;
      return safeExcerptHtml(rendered);
    }
  }
  return `<p>${escapeHtml(fallback)}</p>`;
}
