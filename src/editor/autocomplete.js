/*
Copyright 2019 New Vector Ltd
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

export default class AutocompleteWrapperModel {
    constructor(updateCallback, getAutocompleterComponent, updateQuery, partCreator) {
        this._updateCallback = updateCallback;
        this._getAutocompleterComponent = getAutocompleterComponent;
        this._updateQuery = updateQuery;
        this._partCreator = partCreator;
        this._query = null;
    }

    onEscape(e) {
        this._getAutocompleterComponent().onEscape(e);
        this._updateCallback({
            replaceParts: [this._partCreator.plain(this._queryPart.text)],
            close: true,
        });
    }

    close() {
        this._updateCallback({close: true});
    }

    hasSelection() {
        return this._getAutocompleterComponent().hasSelection();
    }

    hasCompletions() {
        const ac = this._getAutocompleterComponent();
        return ac && ac.countCompletions() > 0;
    }

    onEnter() {
        this._updateCallback({close: true});
    }

    async onTab(e) {
        const acComponent = this._getAutocompleterComponent();

        if (acComponent.countCompletions() === 0) {
            // Force completions to show for the text currently entered
            await acComponent.forceComplete();
            // Select the first item by moving "down"
            await acComponent.moveSelection(+1);
        } else {
            await acComponent.moveSelection(e.shiftKey ? -1 : +1);
        }
    }

    onUpArrow() {
        this._getAutocompleterComponent().moveSelection(-1);
    }

    onDownArrow() {
        this._getAutocompleterComponent().moveSelection(+1);
    }

    onPartUpdate(part, pos) {
        // cache the typed value and caret here
        // so we can restore it in onComponentSelectionChange when the value is undefined (meaning it should be the typed text)
        this._queryPart = part;
        this._partIndex = pos.index;
        return this._updateQuery(part.text);
    }

    onComponentSelectionChange(completion) {
        if (!completion) {
            this._updateCallback({
                replaceParts: [this._queryPart],
            });
        } else {
            this._updateCallback({
                replaceParts: this._partForCompletion(completion),
            });
        }
    }

    onComponentConfirm(completion) {
        this._updateCallback({
            replaceParts: this._partForCompletion(completion),
            close: true,
        });
    }

    _partForCompletion(completion) {
        const {completionId} = completion;
        const text = completion.completion;
        switch (completion.type) {
            case "room":
                return [this._partCreator.roomPill(text, completionId), this._partCreator.plain(completion.suffix)];
            case "at-room":
                return [this._partCreator.atRoomPill(completionId), this._partCreator.plain(completion.suffix)];
            case "user":
                // not using suffix here, because we also need to calculate
                // the suffix when clicking a display name to insert a mention,
                // which happens in createMentionParts
                return this._partCreator.createMentionParts(this._partIndex, text, completionId);
            case "command":
                // command needs special handling for auto complete, but also renders as plain texts
                return [this._partCreator.command(text)];
            default:
                // used for emoji and other plain text completion replacement
                return [this._partCreator.plain(text)];
        }
    }
}
