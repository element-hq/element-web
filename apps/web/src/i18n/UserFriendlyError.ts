/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { type StringVariables } from "@element-hq/web-shared-components";
import { _t } from "@element-hq/web-shared-components";

export interface ErrorOptions {
    // Because we're mixing the substitution variables and `cause` into the same object
    // below, we want them to always explicitly say whether there is an underlying error
    // or not to avoid typos of "cause" slipping through unnoticed.
    cause: unknown | undefined;
}

/**
 * Used to rethrow an error with a user-friendly translatable message while maintaining
 * access to that original underlying error. Downstream consumers can display the
 * `translatedMessage` property in the UI and inspect the underlying error with the
 * `cause` property.
 *
 * The error message will display as English in the console and logs so Element
 * developers can easily understand the error and find the source in the code. It also
 * helps tools like Sentry deduplicate the error, or just generally searching in
 * rageshakes to find all instances regardless of the users locale.
 *
 * @param message - The untranslated error message text, e.g "Something went wrong with %(foo)s".
 * @param substitutionVariablesAndCause - Variable substitutions for the translation and
 * original cause of the error. If there is no cause, just pass `undefined`, e.g { foo:
 * 'bar', cause: err || undefined }
 */
export class UserFriendlyError extends Error {
    public readonly translatedMessage: string;

    public constructor(
        message: TranslationKey,
        substitutionVariablesAndCause?: Omit<StringVariables, keyof ErrorOptions> | ErrorOptions,
    ) {
        // Prevent "Could not find /%\(cause\)s/g in x" logs to the console by removing it from the list
        const { cause, ...substitutionVariables } = substitutionVariablesAndCause ?? {};
        const errorOptions = { cause };

        // Create the error with the English version of the message that we want to show up in the logs
        const englishTranslatedMessage = _t(message, { ...substitutionVariables, locale: "en" });
        super(englishTranslatedMessage, errorOptions);

        // Also provide a translated version of the error in the users locale to display
        this.translatedMessage = _t(message, substitutionVariables);
    }
}
