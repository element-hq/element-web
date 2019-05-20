/*
Copyright 2019 New Vector Ltd

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

import {UserPillPart, RoomPillPart, PlainPart} from "./parts";

export default class AutocompleteWrapperModel {
    constructor(updateCallback, getAutocompleterComponent, updateQuery, room) {
        this._updateCallback = updateCallback;
        this._getAutocompleterComponent = getAutocompleterComponent;
        this._updateQuery = updateQuery;
        this._query = null;
        this._room = room;
    }

    onEscape(e) {
        this._getAutocompleterComponent().onEscape(e);
        this._updateCallback({
            replacePart: new PlainPart(this._queryPart.text),
            caretOffset: this._queryOffset,
            close: true,
        });
    }

    onEnter() {
        this._updateCallback({close: true});
    }

    onTab() {
        //forceCompletion here?
    }

    onUpArrow() {
        this._getAutocompleterComponent().onUpArrow();
    }

    onDownArrow() {
        this._getAutocompleterComponent().onDownArrow();
    }

    onPartUpdate(part, offset) {
        // cache the typed value and caret here
        // so we can restore it in onComponentSelectionChange when the value is undefined (meaning it should be the typed text)
        this._queryPart = part;
        this._queryOffset = offset;
        this._updateQuery(part.text);
    }

    onComponentSelectionChange(completion) {
        if (!completion) {
            this._updateCallback({
                replacePart: this._queryPart,
                caretOffset: this._queryOffset,
            });
        } else {
            this._updateCallback({
                replacePart: this._partForCompletion(completion),
            });
        }
    }

    onComponentConfirm(completion) {
        this._updateCallback({
            replacePart: this._partForCompletion(completion),
            close: true,
        });
    }

    _partForCompletion(completion) {
        const firstChr = completion.completionId && completion.completionId[0];
        switch (firstChr) {
            case "@": {
                const displayName = completion.completion;
                const userId = completion.completionId;
                const member = this._room.getMember(userId);
                return new UserPillPart(userId, displayName, member);
            }
            case "#": {
                const displayAlias = completion.completionId;
                return new RoomPillPart(displayAlias);
            }
            // also used for emoji completion
            default:
                return new PlainPart(completion.completion);
        }
    }
}
