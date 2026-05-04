import type { ApiRoute, ApiRouteGroup, RouteStatus } from './route-catalog.js';
import {
  apiBasePaths,
  apiConventions,
  authFlowSteps,
  getRouteStatusCounts,
  routeGroups,
} from './route-catalog.js';

type RenderContext = {
  origin: string;
};

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll('\'', '&#39;');
}

function getStatusLabel(status: RouteStatus) {
  switch (status) {
    case 'available':
      return 'Available now';
    case 'scaffold':
      return 'Scaffold only';
    case 'planned':
      return 'Planned next';
  }
}

function renderStatusBadge(status: RouteStatus) {
  return `<span class="status status-${status}">${getStatusLabel(status)}</span>`;
}

function renderMethodBadge(method: ApiRoute['method']) {
  return `<span class="method method-${method.toLowerCase()}">${method}</span>`;
}

function renderShell(title: string, body: string) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
    <style>
      :root {
        color-scheme: light;
        --bg: #f6f4ee;
        --surface: #fffdf8;
        --ink: #181511;
        --muted: #5f584f;
        --line: #d8d1c4;
        --accent: #0d6b55;
        --accent-soft: #e6f4ef;
        --warning: #815d00;
        --warning-soft: #fff5d6;
        --planned: #5b4ab8;
        --planned-soft: #eeebff;
        --shadow: 0 14px 36px rgba(24, 21, 17, 0.08);
      }

      * {
        box-sizing: border-box;
      }

      body {
        margin: 0;
        font-family: ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        color: var(--ink);
        background:
          radial-gradient(circle at top right, rgba(13, 107, 85, 0.09), transparent 24rem),
          linear-gradient(180deg, #f8f6f1 0%, var(--bg) 100%);
      }

      a {
        color: var(--accent);
        text-decoration: none;
      }

      a:hover {
        text-decoration: underline;
      }

      .wrap {
        width: min(1100px, calc(100% - 2rem));
        margin: 0 auto;
        padding: 2rem 0 4rem;
      }

      .hero,
      .panel,
      .group {
        background: var(--surface);
        border: 1px solid var(--line);
        border-radius: 20px;
        box-shadow: var(--shadow);
      }

      .hero {
        padding: 2rem;
        margin-bottom: 1rem;
      }

      .eyebrow {
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.35rem 0.75rem;
        border-radius: 999px;
        background: var(--accent-soft);
        color: var(--accent);
        font-size: 0.85rem;
        font-weight: 700;
        letter-spacing: 0.02em;
      }

      h1 {
        margin: 0.9rem 0 0.5rem;
        font-size: clamp(2rem, 4vw, 3.5rem);
        line-height: 1.05;
      }

      h2 {
        margin: 0 0 0.75rem;
        font-size: 1.4rem;
      }

      h3 {
        margin: 0 0 0.5rem;
        font-size: 1rem;
      }

      p,
      li,
      td {
        color: var(--muted);
        line-height: 1.55;
      }

      code {
        font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
        background: #f3eee3;
        padding: 0.15rem 0.35rem;
        border-radius: 0.4rem;
        color: #2b241d;
      }

      .stats-grid,
      .group-grid {
        display: grid;
        gap: 1rem;
      }

      .stats-grid {
        grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      }

      .group-grid {
        grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      }

      .panel,
      .group {
        padding: 1.25rem;
      }

      .section {
        margin-top: 1rem;
      }

      .method,
      .status {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border-radius: 999px;
        font-size: 0.76rem;
        font-weight: 700;
        letter-spacing: 0.03em;
        padding: 0.28rem 0.6rem;
      }

      .method {
        min-width: 3.8rem;
        color: white;
      }

      .method-get { background: #2563eb; }
      .method-post { background: #0d6b55; }
      .method-put { background: #8b5cf6; }
      .method-patch { background: #d97706; }
      .method-delete { background: #dc2626; }

      .status-available {
        background: var(--accent-soft);
        color: var(--accent);
      }

      .status-scaffold {
        background: var(--warning-soft);
        color: var(--warning);
      }

      .status-planned {
        background: var(--planned-soft);
        color: var(--planned);
      }

      .route-list {
        display: grid;
        gap: 0.75rem;
        margin-top: 1rem;
      }

      .route-item {
        border: 1px solid var(--line);
        border-radius: 16px;
        padding: 0.9rem;
      }

      .route-head {
        display: flex;
        flex-wrap: wrap;
        gap: 0.65rem;
        align-items: center;
        margin-bottom: 0.45rem;
      }

      .route-path {
        font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
        font-size: 0.95rem;
        color: var(--ink);
      }

      .hint {
        color: var(--muted);
        font-size: 0.95rem;
      }

      .actions {
        display: flex;
        flex-wrap: wrap;
        gap: 0.75rem;
        margin-top: 1.25rem;
      }

      .button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 0.85rem 1rem;
        border-radius: 999px;
        border: 1px solid var(--line);
        background: white;
        color: var(--ink);
        font-weight: 700;
      }

      .button-primary {
        background: var(--accent);
        border-color: var(--accent);
        color: white;
      }

      .auth-step-list,
      .convention-list {
        padding-left: 1.15rem;
        margin: 0;
      }

      @media (max-width: 720px) {
        .wrap {
          width: min(100% - 1rem, 1100px);
          padding-top: 1rem;
        }

        .hero,
        .panel,
        .group {
          border-radius: 18px;
        }
      }
    </style>
  </head>
  <body>
    <main class="wrap">
      ${body}
    </main>
  </body>
</html>`;
}

function renderRouteItem(route: ApiRoute) {
  return `<article class="route-item">
    <div class="route-head">
      ${renderMethodBadge(route.method)}
      <span class="route-path">${escapeHtml(route.path)}</span>
      ${renderStatusBadge(route.status)}
      <span class="hint">${escapeHtml(route.auth)} auth</span>
    </div>
    <p>${escapeHtml(route.summary)}</p>
  </article>`;
}

function renderGroupCard(group: ApiRouteGroup) {
  return `<section class="group">
    <h3>${escapeHtml(group.name)}</h3>
    <p>${escapeHtml(group.description)}</p>
    <div class="route-list">
      ${group.routes.map(renderRouteItem).join('')}
    </div>
  </section>`;
}

export function renderLandingPage({ origin }: RenderContext) {
  const counts = getRouteStatusCounts();
  const familySummary = routeGroups
    .map(
      (group) => `<article class="panel">
        <h3>${escapeHtml(group.name)}</h3>
        <p>${escapeHtml(group.description)}</p>
        <p><strong>${group.routes.length}</strong> documented routes in this family.</p>
      </article>`
    )
    .join('');

  return renderShell(
    'Urnway API',
    `<section class="hero">
      <span class="eyebrow">Urnway API</span>
      <h1>Simple landing page for the Mezo-backed travel API.</h1>
      <p>
        This service is the backend contract for <code>urnway-mobile</code> and the
        future <code>urnway-auth-web</code> Passport bridge. The canonical base path is
        <code>${escapeHtml(`${origin}${apiBasePaths.canonical}`)}</code>.
      </p>
      <div class="actions">
        <a class="button button-primary" href="/docs">Open API reference</a>
        <a class="button" href="${escapeHtml(`${apiBasePaths.canonical}/health`)}">Health check</a>
        <a class="button" href="${escapeHtml(apiBasePaths.legacy)}">Legacy alias</a>
      </div>
    </section>

    <section class="section stats-grid">
      <article class="panel">
        <h2>Base URLs</h2>
        <p>Canonical: <code>${escapeHtml(`${origin}${apiBasePaths.canonical}`)}</code></p>
        <p>Legacy alias: <code>${escapeHtml(`${origin}${apiBasePaths.legacy}`)}</code></p>
      </article>
      <article class="panel">
        <h2>Route status</h2>
        <p><strong>${counts.available}</strong> routes available now</p>
        <p><strong>${counts.scaffold}</strong> scaffold routes that still need real logic</p>
        <p><strong>${counts.planned}</strong> planned routes documented next</p>
      </article>
      <article class="panel">
        <h2>Response rules</h2>
        <ul class="convention-list">
          ${apiConventions
            .map((item) => `<li>${escapeHtml(item)}</li>`)
            .join('')}
        </ul>
      </article>
    </section>

    <section class="section panel">
      <h2>Passport auth flow</h2>
      <ol class="auth-step-list">
        ${authFlowSteps.map((step) => `<li>${escapeHtml(step)}</li>`).join('')}
      </ol>
    </section>

    <section class="section">
      <div class="group-grid">
        ${familySummary}
      </div>
    </section>`
  );
}

export function renderDocsPage({ origin }: RenderContext) {
  return renderShell(
    'Urnway API Docs',
    `<section class="hero">
      <span class="eyebrow">API reference</span>
      <h1>Grouped route reference for the current API surface.</h1>
      <p>
        This page is generated from checked-in route metadata. It shows what is
        available now, what is scaffold-only, and what is planned next so the
        team can keep the implementation and docs aligned.
      </p>
      <div class="actions">
        <a class="button button-primary" href="/">Back to landing page</a>
        <a class="button" href="${escapeHtml(`${apiBasePaths.canonical}/health`)}">Health check</a>
      </div>
    </section>

    <section class="section stats-grid">
      <article class="panel">
        <h2>Environment and base URLs</h2>
        <p>Current origin: <code>${escapeHtml(origin)}</code></p>
        <p>Canonical base: <code>${escapeHtml(`${origin}${apiBasePaths.canonical}`)}</code></p>
        <p>Legacy alias: <code>${escapeHtml(`${origin}${apiBasePaths.legacy}`)}</code></p>
      </article>
      <article class="panel">
        <h2>Response envelope</h2>
        <p>All JSON responses should follow <code>{ data, error, meta }</code>.</p>
        <p class="hint">Current scaffold modules already return this shape.</p>
      </article>
      <article class="panel">
        <h2>Auth and conventions</h2>
        <ul class="convention-list">
          ${apiConventions
            .map((item) => `<li>${escapeHtml(item)}</li>`)
            .join('')}
        </ul>
      </article>
    </section>

    <section class="section panel">
      <h2>Auth flow summary</h2>
      <ol class="auth-step-list">
        ${authFlowSteps.map((step) => `<li>${escapeHtml(step)}</li>`).join('')}
      </ol>
    </section>

    <section class="section">
      <div class="group-grid">
        ${routeGroups.map(renderGroupCard).join('')}
      </div>
    </section>`
  );
}
