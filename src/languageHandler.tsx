/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import {
    IVariables,
    TranslatedString,
    TranslationKey as ReactTranslationKey,
    // eslint-disable-next-line camelcase
    _t as react_t,
    // eslint-disable-next-line camelcase
    _td as react_td,
    // eslint-disable-next-line camelcase
    _tDom as react_tDom,
    Tags,
    UserFriendlyError as ReactUserFriendlyError,
    ErrorOptions,
} from "matrix-react-sdk/src/languageHandler";
import { Leaves } from "matrix-react-sdk/src/@types/common";

import type ReactEN from "matrix-react-sdk/src/i18n/strings/en_EN.json";
import type EN from "./i18n/strings/en_EN.json";

/**
 * This module wraps languageHandler in the matrix-react-sdk and adds type casts to include translations
 * which we know will be injected by webpack.
 */

export type TranslationKey = Leaves<typeof EN & typeof ReactEN, "|", string | { other: string }, 4>;

export class UserFriendlyError extends ReactUserFriendlyError {
    public constructor(message: TranslationKey, substitutionVariablesAndCause?: IVariables & ErrorOptions) {
        super(message as ReactTranslationKey, substitutionVariablesAndCause);
    }
}

export function _td(s: TranslationKey): TranslationKey {
    return react_td(s as ReactTranslationKey);
}

// eslint-next-line @typescript-eslint/naming-convention
export function _t(text: TranslationKey, variables?: IVariables): string;
export function _t(text: TranslationKey, variables: IVariables | undefined, tags: Tags): React.ReactNode;
export function _t(text: TranslationKey, variables?: IVariables, tags?: Tags): TranslatedString {
    return react_t(text as ReactTranslationKey, variables, tags!);
}

// eslint-next-line @typescript-eslint/naming-convention
export function _tDom(text: TranslationKey, variables?: IVariables): TranslatedString;
export function _tDom(text: TranslationKey, variables: IVariables, tags: Tags): React.ReactNode;
export function _tDom(text: TranslationKey, variables?: IVariables, tags?: Tags): TranslatedString {
    return react_tDom(text as ReactTranslationKey, variables!, tags!);
}
