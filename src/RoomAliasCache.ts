/*
Copyright 2019, 2021 The Matrix.org Foundation C.I.C.

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

/**
 * This is meant to be a cache of room alias to room ID so that moving between
 * rooms happens smoothly (for example using browser back / forward buttons).
 *
 * For the moment, it's in memory only and so only applies for the current
 * session for simplicity, but could be extended further in the future.
 *
 * A similar thing could also be achieved via `pushState` with a state object,
 * but keeping it separate like this seems easier in case we do want to extend.
 */
const aliasToIDMap = new Map<string, string>();

export function storeRoomAliasInCache(alias: string, id: string): void {
    aliasToIDMap.set(alias, id);
}

export function getCachedRoomIDForAlias(alias: string): string | undefined {
    return aliasToIDMap.get(alias);
}
