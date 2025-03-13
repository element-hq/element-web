/*
Copyright 2024 New Vector Ltd.
Copyright 2023 Boluwatife Omosowon <boluomosowon@gmail.com>

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { parsePermalink } from "./permalinks/Permalinks";

/**
 * Returns the primaryEntityId(roomIdOrAlias or userId) if the search term
 * is a permalink and the primaryEntityId is not null. Otherwise, it returns
 * the original search term.
 * E.g https://matrix.to/#/#element-dev:matrix.org returns #element-dev:matrix.org
 * @param {string} searchTerm The search term.
 * @returns {string} The roomId, alias, userId, or the original search term
 */
export function transformSearchTerm(searchTerm: string): string {
    const parseLink = parsePermalink(searchTerm);
    return parseLink?.primaryEntityId ?? searchTerm;
}
