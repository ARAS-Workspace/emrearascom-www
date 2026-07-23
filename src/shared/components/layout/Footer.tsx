import React from 'react';
import { Grid, Column } from '@carbon/react';
import { useLocale } from '@shared/hooks';
import { translate } from '@shared/translations';
import './styles/Footer.scss';

const Footer: React.FC = () => {
  const { locale } = useLocale();
  const t = translate(locale);

  return (
    <footer className="footer">
      <div className="footer-separator" />

      <Grid className="footer-grid" narrow>
        <Column lg={16} md={8} sm={4} className="footer-content-column">
          <p className="footer-copyright-text">{t.footer.copyright.text}</p>
        </Column>
      </Grid>
    </footer>
  );
};

export default Footer;
