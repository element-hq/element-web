/*
Copyright 2024 New Vector Ltd.
Copyright 2019-2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type Room, type MatrixClient, type RoomMember } from "matrix-js-sdk/src/matrix";

import { type UpdateCallback } from "../../../src/editor/autocomplete";
import type AutocompleteWrapperModel from "../../../src/editor/autocomplete";
import { type Caret } from "../../../src/editor/caret";
import { type PillPart, type Part, PartCreator } from "../../../src/editor/parts";
import DocumentPosition from "../../../src/editor/position";

export class MockAutoComplete {
    public _updateCallback;
    public _partCreator;
    public _completions;
    public _part: Part | null;

    constructor(updateCallback: UpdateCallback, partCreator: PartCreator, completions: PillPart[]) {
        this._updateCallback = updateCallback;
        this._partCreator = partCreator;
        this._completions = completions;
        this._part = null;
    }

    close() {
        this._updateCallback({ close: true });
    }

    tryComplete(close = true) {
        const matches = this._completions.filter((o) => {
            return this._part && o.resourceId.startsWith(this._part.text);
        });
        if (matches.length === 1 && this._part && this._part.text.length > 1) {
            const match = matches[0];
            let pill: PillPart;
            if (match.resourceId[0] === "@") {
                pill = this._partCreator.userPill(match.text, match.resourceId);
            } else {
                pill = this._partCreator.roomPill(match.resourceId);
            }
            this._updateCallback({ replaceParts: [pill], close });
        }
    }

    // called by EditorModel when typing into pill-candidate part
    onPartUpdate(part: Part, pos: DocumentPosition) {
        this._part = part;
    }
}

// MockClient & MockRoom are only used for avatars in room and user pills,
// which is not tested
class MockRoom {
    getMember(): RoomMember | null {
        return null;
    }
}

export function createPartCreator(completions: PillPart[] = []) {
    const autoCompleteCreator = (partCreator: PartCreator) => {
        return (updateCallback: UpdateCallback) =>
            new MockAutoComplete(updateCallback, partCreator, completions) as unknown as AutocompleteWrapperModel;
    };
    const room = new MockRoom() as unknown as Room;
    const client = {
        getRooms: jest.fn().mockReturnValue([]),
        getRoom: jest.fn().mockReturnValue(null),
    } as unknown as MatrixClient;
    return new PartCreator(room, client, autoCompleteCreator);
}

export function createRenderer() {
    const render = (c?: Caret) => {
        render.caret = c;
        render.count += 1;
    };
    render.count = 0;
    render.caret = null as unknown as Caret | undefined;
    return render;
}

// in many tests we need to narrow the caret type
export function isDocumentPosition(caret: Caret): caret is DocumentPosition {
    return caret instanceof DocumentPosition;
}
