import { CodeSnippet } from '@carbon/react';
import CodeHighlight from '@shared/components/visualization/CodeHighlight';
import SimpleTable from '@shared/components/data/SimpleTable';
import Figure from './Figure';

// noinspection JSUnusedGlobalSymbols
export const components = {
  // Carbon-styled content image for posts: <Figure src alt caption width height />
  Figure,
  // Bare markdown images (![]()) load lazily; Figure.scss keeps them responsive.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  img: (props: any) => <img {...props} loading="lazy" decoding="async" alt={props.alt ?? ''} />,
  // Absolute (http/https) links point off-site (e.g. source on GitHub), so they
  // open in a new tab; relative links stay in-app.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  a: (props: any) =>
    /^https?:\/\//.test(props.href ?? '') ? (
      <a {...props} target="_blank" rel="noopener noreferrer" />
    ) : (
      <a {...props} />
    ),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  pre: (props: any) => {
    const code = props.children;
    if (!code?.props?.children) return <pre {...props} />;

    const content = code.props.children as string;
    const lang = (code.props.className as string | undefined)
      ?.replace('language-', '')
      ?.trim();

    // Language specified → shiki syntax highlighting
    if (lang) {
      return <CodeHighlight.Lazy code={content} lang={lang} />;
    }

    // No language → plain Carbon CodeSnippet
    return (
      <CodeSnippet type="multi" hideCopyButton>
        {content}
      </CodeSnippet>
    );
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  code: (props: any) => <code {...props} />,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  table: (props: any) => <SimpleTable>{props.children}</SimpleTable>,
};
