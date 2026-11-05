/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import type { Session } from "electron";

/** How to set up the spellchecker. */
export interface SpellCheckerOptions {
    /** Whether the spellchecker is turned on. */
    enabled: boolean;
    /** The URL of the directory holding the dictionary files, from `spell_checker_dictionary_download_url`. */
    dictionaryDownloadUrl?: string;
}

/**
 * Turns the spellchecker on or off, and makes it download its dictionaries from `dictionaryDownloadUrl`, if one is
 * given, instead of Electron's default CDN.
 * Must be called once the app is ready, as Electron does not hand out sessions before then.
 *
 * @param session - the session whose spellchecker to configure.
 * @param options - how to set up the spellchecker.
 */
export function configureSpellChecker(
    session: Pick<Session, "setSpellCheckerEnabled" | "setSpellCheckerDictionaryDownloadURL">,
    { enabled, dictionaryDownloadUrl }: SpellCheckerOptions,
): void {
    // Set the download URL first, so that no dictionary is fetched from the default CDN in the meantime
    if (dictionaryDownloadUrl) {
        // Electron appends the file name directly, so a URL without the trailing slash would point at the wrong files
        const url = dictionaryDownloadUrl.endsWith("/") ? dictionaryDownloadUrl : `${dictionaryDownloadUrl}/`;
        session.setSpellCheckerDictionaryDownloadURL(url);
    }
    session.setSpellCheckerEnabled(enabled);
}
