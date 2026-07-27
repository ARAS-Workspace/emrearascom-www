import React from 'react';
import { Grid, Column } from '@carbon/react';
import MDXProvider from './MDXProvider';
import './styles/MDXContent.scss';

interface MDXPageRendererProps {
  content: React.ComponentType;
}

const MDXPageRenderer: React.FC<MDXPageRendererProps> = ({ content: Content }) => {
  return (
    <section className="mdx-page">
      <Grid>
        <Column lg={16} md={8} sm={4}>
          <MDXProvider>
            <article className="mdx-content">
              <Content />
            </article>
          </MDXProvider>
        </Column>
      </Grid>
    </section>
  );
};

export default MDXPageRenderer;
