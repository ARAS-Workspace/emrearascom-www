import React from 'react';
import { Link } from 'react-router-dom';
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

          {/*
            The notice describes the agent on /ai, but it is reachable from
            every page: someone who wants to know what a site records should not
            have to open the thing that records to find out. A router Link
            rather than an anchor, so the switch costs no reload.
          */}
          <Link to="/privacy" className="footer-privacy-link">
            {t.footer.privacy}
          </Link>
        </Column>
      </Grid>
    </footer>
  );
};

export default Footer;
