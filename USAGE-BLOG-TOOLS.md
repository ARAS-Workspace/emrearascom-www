# Blog Tooling Guide

Türkçe için: [USAGE-BLOG-TOOLS.tr.md](USAGE-BLOG-TOOLS-TR.md)

The blog is file based. Each post lives in its own directory under
`src/pages/blog/posts/<slug>/`. The router is never edited: if a directory
exists under `posts/`, the post is published; otherwise it is not. A `<slug>`
must be kebab-case (for example, `wireguard-notes`).

## Commands

| Command                     | What it does                                                                              |
|-----------------------------|-------------------------------------------------------------------------------------------|
| `npm run new-post <slug>`   | Creates a new post directory from the template and stamps the dates.                      |
| `npm run touch-post <slug>` | Sets the post's updated date to the current time. The created date is left unchanged.     |
| `npm run generate-llms`     | Generates the posts' `llms/*.txt` files from their MDX source. These files are committed. |
| `npm run gen-covers`        | Generates the OG cover images. These are a build output and are not committed.            |

## Adding a Post

```bash
npm run new-post wireguard-notes
```

This creates `src/pages/blog/posts/wireguard-notes/`, containing `meta.json`,
`index.mdx` (Turkish) and `index.en.mdx` (English). Then:

1. Fill in `meta.json`: the title and description under `seo.tr` and `seo.en`, the `tags` list, and optionally `author`. If `author` is left empty, the post is attributed to the site owner.
2. Write the `index.mdx` and `index.en.mdx` bodies.
3. Preview at `https://localhost:5173/blog/wireguard-notes` with `npm run dev`.
4. Run `npm run generate-llms`.
5. Commit the changes. Push and deployment follow from there.

The cover image (OG image) is generated automatically from the title and
description during the production build. No manual step is required.

## Updating a Post

After editing the content, refresh the updated date:

```bash
npm run touch-post wireguard-notes
```

This updates only the `updatedAt` field in `meta.json`. If the content changed,
run `npm run generate-llms` and commit the result.

## Removing or Unpublishing a Post

To unpublish (reversible), move the directory out of `posts/`:

```bash
mv src/pages/blog/posts/wireguard-notes /somewhere/else/
```

To delete permanently:

```bash
rm -rf src/pages/blog/posts/wireguard-notes
```

In both cases the router is left untouched; routes are resolved from disk. The
`llms/*.txt` files are removed together with the directory, so no separate
generation step is needed. Committing the change is sufficient.

## Notes

- Dates are stored in `meta.json` as `DD/MM/YYYY HH:mm` in Istanbul time.
- Do not use `#` (H1) in the body. Headings start at `##`. The H1 is rendered from `seo.title`.
- For a full pre-publish check, run `npm run prod`. It covers the build, prerender, llms and cover generation.
