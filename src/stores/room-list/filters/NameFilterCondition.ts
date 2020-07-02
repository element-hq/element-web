/*
Copyright 2020 The Matrix.org Foundation C.I.C.

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

import { Room } from "matrix-js-sdk/src/models/room";
import { FILTER_CHANGED, FilterPriority, IFilterCondition } from "./IFilterCondition";
import { EventEmitter } from "events";
import { removeHiddenChars } from "matrix-js-sdk/src/utils";

/**
 * A filter condition for the room list which reveals rooms of a particular
 * name, or associated name (like a room alias).
 */
export class NameFilterCondition extends EventEmitter implements IFilterCondition {
    private _search = "";

    constructor() {
        super();
    }

    public get relativePriority(): FilterPriority {
        // We want this one to be at the highest priority so it can search within other filters.
        return FilterPriority.Highest;
    }

    public get search(): string {
        return this._search;
    }

    public set search(val: string) {
        this._search = val;
        this.emit(FILTER_CHANGED);
    }

    public isVisible(room: Room): boolean {
        const lcFilter = this.search.toLowerCase();
        if (this.search[0] === '#') {
            // Try and find rooms by alias
            if (room.getCanonicalAlias() && room.getCanonicalAlias().toLowerCase().startsWith(lcFilter)) {
                return true;
            }
            if (room.getAltAliases().some(a => a.toLowerCase().startsWith(lcFilter))) {
                return true;
            }
        }

        if (!room.name) return false; // should realistically not happen: the js-sdk always calculates a name

        return this.matches(room.name);
    }

    public matches(val: string): boolean {
        // Note: we have to match the filter with the removeHiddenChars() room name because the
        // function strips spaces and other characters (M becomes RN for example, in lowercase).
        // We also doubly convert to lowercase to work around oddities of the library.
        const noSecretsFilter = removeHiddenChars(this.search.toLowerCase()).toLowerCase();
        const noSecretsName = removeHiddenChars(val.toLowerCase()).toLowerCase();
        return noSecretsName.includes(noSecretsFilter);
    }
}
