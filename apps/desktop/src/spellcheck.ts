/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import type { Session } from "electron";

/**
 * Makes the spellchecker download its dictionaries from `url`, if one is given, instead of Electron's default CDN.
 * Must be called once the app is ready, as Electron does not hand out sessions before then.
 *
 * @param session - the session whose spellchecker to configure.
 * @param url - the URL of the directory holding the dictionary files, from `spell_checker_dictionary_download_url`.
 */
export function configureSpellCheckerDictionaries(
    session: Pick<Session, "setSpellCheckerDictionaryDownloadURL">,
    url: string | undefined,
): void {
    if (!url) return;
    // Electron appends the file name directly, so a URL without the trailing slash would point at the wrong files
    session.setSpellCheckerDictionaryDownloadURL(url.endsWith("/") ? url : `${url}/`);
}
