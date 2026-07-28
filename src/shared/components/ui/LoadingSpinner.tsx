import React from 'react';
import { Loading } from '@carbon/react';
import { useLocale } from '@shared/hooks';
import { translate } from '@shared/translations';
import './styles/LoadingSpinner.scss';

interface LoadingSpinnerProps {
  text?: string;
  fullscreen?: boolean;
  fullpage?: boolean;
  small?: boolean;
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  text,
  fullscreen = false,
  fullpage = false,
  small = false,
}) => {
  const { locale } = useLocale();
  const t = translate(locale);

  const loadingText =
    text || (fullscreen || fullpage ? t.loadingSpinner.pageLoading : t.loadingSpinner.loading);

  // `fullscreen` lives outside the layout (the router's root fallback) and owns
  // the whole viewport. `fullpage` is its in-layout sibling: header and footer
  // stay on screen, the spinner centers in the content region between them.
  if (fullscreen || fullpage) {
    return (
      <div
        className={`loading-spinner-container${fullpage ? ' loading-spinner-container--fullpage' : ''}`}
      >
        <div className="loading-spinner-content">
          <Loading withOverlay={false} description={loadingText} className="loading-spinner-icon" />
          <p className="loading-spinner-text">{loadingText}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`loading-spinner-inline ${small ? 'loading-spinner-inline--small' : ''}`}>
      <Loading withOverlay={false} small={small} description={loadingText} />
    </div>
  );
};

export default LoadingSpinner;
