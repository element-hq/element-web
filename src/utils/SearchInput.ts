/*
Copyright 2023 Boluwatife Omosowon <boluomosowon@gmail.com>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
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
