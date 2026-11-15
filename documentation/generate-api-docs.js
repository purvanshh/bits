// Generates openapi.json and API_REFERENCE.md from the live OpenAPI spec (gateway/docs/swagger.js),
// so the written reference always matches the served Swagger UI.   Usage: npm run docs:generate
const fs = require('fs');
const path = require('path');
process.env.GATEWAY_PORT = process.env.GATEWAY_PORT || '4000';
const spec = require('../gateway/docs/swagger');

fs.writeFileSync(path.join(__dirname, 'openapi.json'), JSON.stringify(spec, null, 2) + '\n');

const resolve = (o) => (o && o.$ref ? spec.components[o.$ref.split('/')[2]][o.$ref.split('/')[3]] : o);
const refName = (o) => (o && o.$ref ? o.$ref.split('/').pop() : null);
const typeOf = (s) => {
  if (!s) return '';
  if (s.$ref) return refName(s);
  if (s.type === 'array') return `array<${typeOf(s.items)}>`;
  return s.type + (s.enum ? ` (${s.enum.join(' \\| ')})` : '');
};
const authOf = (op) => {
  const sec = op.security;
  if (Array.isArray(sec) && sec.length === 0) return 'Public';
  const keys = new Set((sec || spec.security).flatMap((s) => Object.keys(s)));
  return keys.has('BearerAuth') ? 'API key + JWT' : 'API key';
};
const roleOf = (op) => {
  const m = /\*\*Required role:\*\*\s*([^.]*)\./.exec(op.description || '');
  if (m) return m[1];
  return authOf(op) === 'API key + JWT' ? 'any authenticated role' : '–';
};
const clean = (t = '') => t.replace(/\*\*Required role:\*\*[^.]*\.\s*/, '').replace(/\n/g, ' ').trim();
const schemaTable = (name, s) => {
  const req = new Set(s.required || []);
  const rows = Object.entries(s.properties || {}).map(([k, v]) =>
    `| \`${k}\` | ${typeOf(v)} | ${req.has(k) ? 'yes' : ''} | ${(v.description || '').replace(/\|/g, '\\|')} |`);
  return `### ${name}\n${s.description ? s.description + '\n\n' : '\n'}| Field | Type | Required | Notes |\n|---|---|:-:|---|\n${rows.join('\n')}\n`;
};

const out = [];
out.push(`# ${spec.info.title} – API Reference (v${spec.info.version})\n`);
out.push('> Generated from the OpenAPI document served at `http://localhost:4000/api-docs.json` (Swagger UI: `http://localhost:4000/api-docs`). Do not edit by hand – run `npm run docs:generate`.\n');
out.push(`${spec.info.description}\n`);
out.push('## Authentication\n');
out.push('| Scheme | Type | Where | Used for |\n|---|---|---|---|');
out.push('| `ApiKeyAuth` | apiKey | header `x-api-key` | **Gateway authentication** – required on every `/api/*` request |');
out.push('| `BearerAuth` | HTTP bearer (JWT) | header `Authorization: Bearer <token>` | **Backend authorization** – token from `POST /api/users/login`, role checked by the service |\n');
out.push('Base URL (gateway): `' + spec.servers[0].url + '`\n');

// endpoint index
const ops = [];
for (const [p, item] of Object.entries(spec.paths))
  for (const [m, op] of Object.entries(item)) if (m !== 'parameters') ops.push({ p, m, op, shared: item.parameters || [] });
out.push('## Endpoint summary\n');
out.push('| Method | Path | Summary | Auth | Roles |\n|---|---|---|---|---|');
ops.forEach(({ p, m, op }) => out.push(`| ${m.toUpperCase()} | \`${p}\` | ${op.summary} | ${authOf(op)} | ${roleOf(op)} |`));
out.push(`\n${ops.length} operations across ${spec.tags.length - 1} services.\n`);

const byTag = {};
ops.forEach((o) => (byTag[o.op.tags[0]] ||= []).push(o));
for (const tag of spec.tags.map((t) => t.name)) {
  if (!byTag[tag]) continue;
  const t = spec.tags.find((x) => x.name === tag);
  out.push(`## ${tag}${t.description ? ` – ${t.description}` : ''}\n`);
  for (const { p, m, op, shared } of byTag[tag]) {
    out.push(`### ${m.toUpperCase()} \`${p}\`\n`);
    out.push(`**${op.summary}.** ${clean(op.description)}\n`);
    out.push(`- **Authentication:** ${authOf(op)}${authOf(op) === 'Public' ? '' : ' (`x-api-key`' + (authOf(op) === 'API key + JWT' ? ' + `Authorization: Bearer <JWT>`' : '') + ')'}`);
    out.push(`- **Required role:** ${roleOf(op)}`);
    const params = [...shared, ...(op.parameters || [])];
    if (params.length) {
      out.push('\n| Parameter | In | Type | Required | Description |\n|---|---|---|:-:|---|');
      params.forEach((q) => out.push(`| \`${q.name}\` | ${q.in} | ${typeOf(q.schema)} | ${q.required ? 'yes' : ''} | ${q.description || ''} |`));
    }
    if (op.requestBody) {
      const c = op.requestBody.content['application/json'];
      out.push(`\n**Request body** (\`application/json\`, schema \`${typeOf(c.schema)}\`):\n\n\`\`\`json\n${JSON.stringify(c.example ?? {}, null, 2)}\n\`\`\``);
    }
    out.push('\n**Responses**\n\n| Status | Meaning | Model |\n|---|---|---|');
    for (const [code, r] of Object.entries(op.responses)) {
      const rr = resolve(r);
      const model = rr.content ? typeOf(rr.content['application/json'].schema) : '';
      out.push(`| ${code} | ${rr.description.replace(/\|/g, '\\|')} | ${model} |`);
    }
    const okCode = Object.keys(op.responses).find((c) => c.startsWith('2'));
    const ex = resolve(op.responses[okCode])?.content?.['application/json']?.example;
    if (ex) out.push(`\nExample \`${okCode}\` response:\n\n\`\`\`json\n${JSON.stringify(ex, null, 2)}\n\`\`\``);
    out.push('');
  }
}
out.push('## Error model\n');
out.push('All errors use `{ "success": false, "message": "…" }`; gateway and geocoder errors add a machine-readable `error` code.\n');
out.push('| Status | `error` code | Raised by | Cause |\n|---|---|---|---|');
[
  [400, 'MALFORMED_JSON', 'Gateway', 'Request body is not valid JSON'],
  [400, '–', 'Backend', 'Missing/invalid parameters or validation failure'],
  [401, 'MISSING_API_KEY / INVALID_API_KEY', 'Gateway', 'No / wrong `x-api-key`'],
  [401, '–', 'Backend', 'Missing, invalid or expired JWT; bad credentials'],
  [403, '–', 'Backend', 'JWT valid but role not permitted'],
  [404, 'ADDRESS_NOT_FOUND / –', 'Backend', 'Resource or geocoded address not found'],
  [409, '–', 'Backend', 'Duplicate unique field'],
  [429, 'RATE_LIMIT_EXCEEDED / AUTH_RATE_LIMIT_EXCEEDED', 'Gateway', 'Per-IP rate limit (headers `RateLimit-*`, `Retry-After`)'],
  [429, 'GEOCODER_RATE_LIMITED', 'Backend', 'Nominatim is throttling – retry after `retryAfter` seconds'],
  [502, 'GEOCODER_ERROR / GEOCODER_UNAVAILABLE / GEOCODER_INVALID_COORDINATES', 'Backend', 'Geocoding provider failure'],
  [503, 'SERVICE_UNAVAILABLE', 'Gateway', 'Target service unreachable'],
  [504, 'GATEWAY_TIMEOUT / GEOCODER_TIMEOUT', 'Gateway / Backend', 'Upstream timed out'],
].forEach((r) => out.push(`| ${r[0]} | ${r[1]} | ${r[2]} | ${r[3]} |`));
out.push('\n## Schemas\n');
Object.entries(spec.components.schemas).forEach(([n, s]) => out.push(schemaTable(n, s)));

fs.writeFileSync(path.join(__dirname, 'API_REFERENCE.md'), out.join('\n') + '\n');
console.log(`Wrote documentation/openapi.json and API_REFERENCE.md (${ops.length} operations, ${Object.keys(spec.components.schemas).length} schemas)`);
