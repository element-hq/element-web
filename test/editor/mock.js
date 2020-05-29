/*
Copyright 2019 The Matrix.org Foundation C.I.C.

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

import {PartCreator} from "../../src/editor/parts";

class MockAutoComplete {
    constructor(updateCallback, partCreator, completions) {
        this._updateCallback = updateCallback;
        this._partCreator = partCreator;
        this._completions = completions;
        this._part = null;
    }

    close() {
        this._updateCallback({close: true});
    }

    tryComplete(close = true) {
        const matches = this._completions.filter(o => {
            return o.resourceId.startsWith(this._part.text);
        });
        if (matches.length === 1 && this._part.text.length > 1) {
            const match = matches[0];
            let pill;
            if (match.resourceId[0] === "@") {
                pill = this._partCreator.userPill(match.label, match.resourceId);
            } else {
                pill = this._partCreator.roomPill(match.resourceId);
            }
            this._updateCallback({replaceParts: [pill], close});
        }
    }

    // called by EditorModel when typing into pill-candidate part
    onPartUpdate(part, pos) {
        this._part = part;
    }
}

// MockClient & MockRoom are only used for avatars in room and user pills,
// which is not tested
class MockClient {
    getRooms() { return []; }
    getRoom() { return null; }
}

class MockRoom {
    getMember() { return null; }
}

export function createPartCreator(completions = []) {
    const autoCompleteCreator = (partCreator) => {
        return (updateCallback) => new MockAutoComplete(updateCallback, partCreator, completions);
    };
    return new PartCreator(new MockRoom(), new MockClient(), autoCompleteCreator);
}

export function createRenderer() {
    const render = (c) => {
        render.caret = c;
        render.count += 1;
    };
    render.count = 0;
    render.caret = null;
    return render;
}
