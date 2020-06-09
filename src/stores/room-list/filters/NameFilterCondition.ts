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
        console.log("Updating filter for room name search:", this._search);
        this.emit(FILTER_CHANGED);
    }

    public isVisible(room: Room): boolean {
        // TODO: Improve this filter to include aliases and such
        return room.name.toLowerCase().indexOf(this.search.toLowerCase()) >= 0;
    }
}
