// SPDX-License-Identifier: AGPL-3.0-or-later
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

import React, { useState } from 'react';
import { Modal, CodeSnippet } from '@carbon/react';
import { Password } from '@carbon/icons-react';

import { useLocale } from '@shared/hooks';
import { translate } from '@shared/translations';
import publicKey from './assets/PgpKey/public-key.asc?raw';
import './styles/PgpKey.scss';

/**
 * A link-styled trigger (sits beside the intro's GitHub / e-mail links) that
 * opens a modal holding the owner's PGP public key in a Carbon CodeSnippet —
 * a scrollable code block with a built-in copy button, so the key can be lifted
 * straight into a keyring. The key is inlined from an .asc asset.
 */
const PgpKey: React.FC = () => {
  const [open, setOpen] = useState(false);
  const { locale } = useLocale();
  const t = translate(locale);

  return (
    <>
      <button
        type="button"
        className="home-link home-pgp-trigger"
        onClick={() => setOpen(true)}
        aria-label={t.pgp.aria}
      >
        {t.pgp.label}
        <Password size={16} className="home-pgp-trigger__icon" />
      </button>

      <Modal
        open={open}
        onRequestClose={() => setOpen(false)}
        passiveModal
        size="lg"
        className="pgp-modal"
        modalHeading={t.pgp.heading}
        modalAriaLabel={t.pgp.heading}
        closeButtonLabel={t.pgp.close}
      >
        <CodeSnippet
          type="multi"
          feedback={t.pgp.copied}
          copyButtonDescription={t.pgp.copy}
          showMoreText={t.pgp.showMore}
          showLessText={t.pgp.showLess}
          className="home-pgp-snippet"
        >
          {publicKey.trim()}
        </CodeSnippet>
      </Modal>
    </>
  );
};

export default PgpKey;
