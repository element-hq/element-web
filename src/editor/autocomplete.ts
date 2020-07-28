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

import {KeyboardEvent} from "react";

import {Part, CommandPartCreator, PartCreator} from "./parts";
import DocumentPosition from "./position";
import {ICompletion} from "../autocomplete/Autocompleter";
import Autocomplete from "../components/views/rooms/Autocomplete";

export interface ICallback {
    replaceParts?: Part[];
    close?: boolean;
}

export type UpdateCallback = (data: ICallback) => void;
export type GetAutocompleterComponent = () => Autocomplete;
export type UpdateQuery = (test: string) => Promise<void>;

export default class AutocompleteWrapperModel {
    private queryPart: Part;
    private partIndex: number;

    constructor(
        private updateCallback: UpdateCallback,
        private getAutocompleterComponent: GetAutocompleterComponent,
        private updateQuery: UpdateQuery,
        private partCreator: PartCreator | CommandPartCreator,
    ) {
    }

    public onEscape(e: KeyboardEvent) {
        this.getAutocompleterComponent().onEscape(e);
        this.updateCallback({
            replaceParts: [this.partCreator.plain(this.queryPart.text)],
            close: true,
        });
    }

    public close() {
        this.updateCallback({close: true});
    }

    public hasSelection() {
        return this.getAutocompleterComponent().hasSelection();
    }

    public hasCompletions() {
        const ac = this.getAutocompleterComponent();
        return ac && ac.countCompletions() > 0;
    }

    public onEnter() {
        this.updateCallback({close: true});
    }

    public async onTab(e: KeyboardEvent) {
        const acComponent = this.getAutocompleterComponent();

        if (acComponent.countCompletions() === 0) {
            // Force completions to show for the text currently entered
            await acComponent.forceComplete();
            // Select the first item by moving "down"
            await acComponent.moveSelection(+1);
        } else {
            await acComponent.moveSelection(e.shiftKey ? -1 : +1);
        }
    }

    public onUpArrow(e: KeyboardEvent) {
        this.getAutocompleterComponent().moveSelection(-1);
    }

    public onDownArrow(e: KeyboardEvent) {
        this.getAutocompleterComponent().moveSelection(+1);
    }

    public onPartUpdate(part: Part, pos: DocumentPosition) {
        // cache the typed value and caret here
        // so we can restore it in onComponentSelectionChange when the value is undefined (meaning it should be the typed text)
        this.queryPart = part;
        this.partIndex = pos.index;
        return this.updateQuery(part.text);
    }

    public onComponentSelectionChange(completion: ICompletion) {
        if (!completion) {
            this.updateCallback({
                replaceParts: [this.queryPart],
            });
        } else {
            this.updateCallback({
                replaceParts: this.partForCompletion(completion),
            });
        }
    }

    public onComponentConfirm(completion: ICompletion) {
        this.updateCallback({
            replaceParts: this.partForCompletion(completion),
            close: true,
        });
    }

    private partForCompletion(completion: ICompletion) {
        const {completionId} = completion;
        const text = completion.completion;
        switch (completion.type) {
            case "room":
                return [this.partCreator.roomPill(text, completionId), this.partCreator.plain(completion.suffix)];
            case "at-room":
                return [this.partCreator.atRoomPill(completionId), this.partCreator.plain(completion.suffix)];
            case "user":
                // not using suffix here, because we also need to calculate
                // the suffix when clicking a display name to insert a mention,
                // which happens in createMentionParts
                return this.partCreator.createMentionParts(this.partIndex, text, completionId);
            case "command":
                // command needs special handling for auto complete, but also renders as plain texts
                return [(this.partCreator as CommandPartCreator).command(text)];
            default:
                // used for emoji and other plain text completion replacement
                return [this.partCreator.plain(text)];
        }
    }
}
