/*
Copyright 2024 New Vector Ltd.
Copyright 2020 Nurjin Jafar
Copyright 2020 Nordeck IT + Consulting GmbH.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
 */

import { type IContent } from "matrix-js-sdk/src/matrix";

/**
 * Checks a message if it contains one of the provided emojis
 * @param  {Object} content The message
 * @param  {Array<string>} emojis The list of emojis to check for
 */
export const containsEmoji = (content: IContent, emojis: Array<string>): boolean => {
    return emojis.some((emoji) => content.body && content.body.includes(emoji));
};
