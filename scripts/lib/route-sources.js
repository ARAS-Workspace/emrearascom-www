// noinspection JSUnusedGlobalSymbols
// noinspection JSUnresolvedReference

/*
 * Copyright (C) 2026 Rıza Emre ARAS <r.emrearas@proton.me>
 *
 * This file is part of emrearas.com.
 *
 * emrearas.com is free software: you can redistribute it and/or modify it
 * under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or (at your
 * option) any later version. See <https://www.gnu.org/licenses/>.
 */

import { readFileSync, existsSync, statSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { parse } from '@babel/parser';
import _traverse from '@babel/traverse';

// Handle ESM/CJS interop for @babel/traverse. The `any` cast is because the
// CJS default export's `.default` property isn't visible to type inference.
const traverse = /** @type {any} */ (_traverse).default || _traverse;

/**
 * Expand a dynamic route into its concrete, content-backed routes.
 *
 * The renderer component lives at `<blog>/post`; its content lives in the
 * sibling `<blog>/posts/<slug>/`. Only directories holding a `meta.json`
 * qualify, so assets and scratch folders never become routes — and an absent
 * `posts/` directory simply yields nothing, which is the right answer for a
 * blog with no posts yet.
 *
 * Only a single trailing dynamic segment is supported; that is the only shape
 * the router uses.
 *
 * @param {string} rawRoute      Route carrying its dynamic segment, e.g. '/blog/:slug'.
 * @param {string} componentDir  Absolute directory of the renderer component.
 * @returns {Array<[string, string]>}  [concrete route, content directory] pairs.
 */
function expandContentRoute(rawRoute, componentDir) {
  const contentRoot = path.join(path.dirname(componentDir), 'posts');
  if (!existsSync(contentRoot)) return [];

  return readdirSync(contentRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .filter((entry) => existsSync(path.join(contentRoot, entry.name, 'meta.json')))
    .map((entry) => [
      rawRoute.replace(/:[^/]+$/, entry.name),
      path.join(contentRoot, entry.name),
    ])
    .sort((a, b) => a[0].localeCompare(b[0]));
}

/**
 * Parse src/router/index.tsx and build a route → absolute page-directory map.
 *
 * The router is the single authority for route ↔ page directory. Only lazy
 * page components are mapped; statically imported wrappers like MainLayout are
 * skipped, because pass 1 records only `const X = lazy(() => import('…'))`
 * declarators.
 *
 * Import → directory resolution (every page is a bare directory import
 * resolved via its own index.tsx):
 *   - `@pages/home`               → src/pages/home
 *   - `@pages/blog/index`         → src/pages/blog/index
 *   - `@pages/blog/post`          → src/pages/blog/post   (the :slug renderer)
 *   - `@shared/pages/x/CompFile`  → src/shared/pages/x    (component-file leaf)
 * Rule: an existing directory maps to itself; anything else (a component file)
 * maps to its parent directory.
 *
 * Dynamic routes are **expanded from the filesystem**, not stripped. A route
 * ending in a dynamic segment (`/blog/:slug`) is rendered by one generic
 * component (`src/pages/blog/post`) but resolves to many concrete URLs, one per
 * content directory in the renderer's sibling `posts/` folder:
 *
 *   /blog/:slug  +  src/pages/blog/post
 *       → /blog/merhaba-dunya  →  src/pages/blog/posts/merhaba-dunya
 *       → /blog/…              →  src/pages/blog/posts/…
 *
 * A content directory counts only when it holds a `meta.json`, so scaffolding
 * (`_template/`, which lives outside `posts/` anyway) and stray folders never
 * become routes. Expansion has to happen HERE rather than in build_routes.js
 * because four consumers share this map — routes.yaml (prerender),
 * generate-llms.js, build-llms.js and the agentic-data-builder's coordinate
 * resolver, which imports this file dynamically — and all four need the
 * concrete per-post routes and directories. Stripping the segment instead
 * would also collapse `/blog/:slug` onto `/blog` and clobber the index route.
 *
 * @param {string} routerPath  Absolute path to src/router/index.tsx.
 * @param {string} srcRoot     Absolute path to src/ — `@pages` resolves to
 *   `<srcRoot>/pages`, `@shared` to `<srcRoot>/shared`.
 * @returns {Map<string, string>}  route → page directory
 */
export function buildRouteMap(routerPath, srcRoot) {
  const ast = parse(readFileSync(routerPath, 'utf8'), {
    sourceType: 'module',
    plugins: ['typescript', 'jsx'],
  });

  const ALIASES = [
    { prefix: '@pages/', root: path.join(srcRoot, 'pages') },
    { prefix: '@shared/', root: path.join(srcRoot, 'shared') },
  ];

  /** @param {string} lit  Lazy-import string literal. @returns {string|null} */
  const resolveDir = (lit) => {
    const alias = ALIASES.find((a) => lit.startsWith(a.prefix));
    if (!alias) return null;
    const abs = path.join(alias.root, lit.slice(alias.prefix.length));
    if (existsSync(abs) && statSync(abs).isDirectory()) return abs;
    return path.dirname(abs);
  };

  // ── Pass 1: component name → source directory ─────────────────────
  /** @type {Map<string, string>} */
  const componentDir = new Map();
  // Arrow-as-property (not a method shorthand) so it isn't misread as an unused
  // named method — Babel invokes it as a visitor, it's never "unused".
  traverse(ast, {
    VariableDeclarator: (p) => {
      const name = p.node.id?.name;
      const init = p.node.init;
      if (!name || init?.type !== 'CallExpression' || init.callee?.name !== 'lazy') return;
      const body = init.arguments[0]?.body; // () => import('…')
      if (body?.type !== 'CallExpression' || body.callee?.type !== 'Import') return;
      const lit = body.arguments[0];
      if (lit?.type !== 'StringLiteral') return;
      const dir = resolveDir(lit.value);
      if (dir) componentDir.set(name, dir);
    },
  });

  // ── Pass 2: walk the route tree, accumulate paths, map route → dir ─
  /** @type {Map<string, string>} */
  const routeDir = new Map();

  const joinPath = (parent, child) => {
    if (!child) return parent;
    if (child.startsWith('/')) return child;
    return parent === '/' ? `/${child}` : `${parent}/${child}`;
  };

  /**
   * @param {any} objNode
   * @param {string} parentPath
   */
  const walk = (objNode, parentPath) => {
    let curPath = parentPath;
    let isIndex = false;
    let elementName;
    let children;
    for (const prop of objNode.properties) {
      if (prop.type !== 'ObjectProperty') continue;
      const key = prop.key.name ?? prop.key.value;
      if (key === 'path' && prop.value.type === 'StringLiteral') {
        curPath = joinPath(parentPath, prop.value.value);
      } else if (key === 'index' && prop.value.type === 'BooleanLiteral') {
        isIndex = prop.value.value;
      } else if (key === 'element' && prop.value.type === 'JSXElement') {
        elementName = prop.value.openingElement?.name?.name;
      } else if (key === 'children' && prop.value.type === 'ArrayExpression') {
        children = prop.value.elements;
      }
    }

    const raw = (isIndex ? parentPath : curPath) || '/';
    if (elementName && componentDir.has(elementName)) {
      const dir = componentDir.get(elementName);
      if (raw.includes(':')) {
        // Content-driven route → one entry per content directory (see header).
        for (const [route, contentDir] of expandContentRoute(raw, dir)) {
          routeDir.set(route, contentDir);
        }
      } else {
        routeDir.set(raw, dir);
      }
    }
    if (children) {
      for (const c of children) if (c?.type === 'ObjectExpression') walk(c, curPath);
    }
  };

  traverse(ast, {
    CallExpression(p) {
      if (p.node.callee?.name !== 'createBrowserRouter') return;
      const arr = p.node.arguments[0];
      if (arr?.type !== 'ArrayExpression') return;
      for (const el of arr.elements) if (el?.type === 'ObjectExpression') walk(el, '');
    },
  });

  return routeDir;
}
