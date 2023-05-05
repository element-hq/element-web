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

import { KeyboardEvent } from "react";

import { Part, CommandPartCreator, PartCreator } from "./parts";
import DocumentPosition from "./position";
import { ICompletion } from "../autocomplete/Autocompleter";
import Autocomplete from "../components/views/rooms/Autocomplete";

export interface ICallback {
    replaceParts?: Part[];
    close?: boolean;
}

export type UpdateCallback = (data: ICallback) => void;
export type GetAutocompleterComponent = () => Autocomplete | null;
export type UpdateQuery = (test: string) => Promise<void>;

export default class AutocompleteWrapperModel {
    private partIndex?: number;

    public constructor(
        private updateCallback: UpdateCallback,
        private getAutocompleterComponent: GetAutocompleterComponent,
        private updateQuery: UpdateQuery,
        private partCreator: PartCreator | CommandPartCreator,
    ) {}

    public onEscape(e: KeyboardEvent): void {
        this.getAutocompleterComponent()?.onEscape(e);
    }

    public close(): void {
        this.updateCallback({ close: true });
    }

    public hasSelection(): boolean {
        return !!this.getAutocompleterComponent()?.hasSelection();
    }

    public hasCompletions(): boolean {
        const ac = this.getAutocompleterComponent();
        return !!ac && ac.countCompletions() > 0;
    }

    public confirmCompletion(): void {
        this.getAutocompleterComponent()?.onConfirmCompletion();
        this.updateCallback({ close: true });
    }

    /**
     * If there is no current autocompletion, start one and move to the first selection.
     */
    public async startSelection(): Promise<void> {
        const acComponent = this.getAutocompleterComponent();
        if (acComponent && acComponent.countCompletions() === 0) {
            // Force completions to show for the text currently entered
            await acComponent.forceComplete();
        }
    }

    public selectPreviousSelection(): void {
        this.getAutocompleterComponent()?.moveSelection(-1);
    }

    public selectNextSelection(): void {
        this.getAutocompleterComponent()?.moveSelection(+1);
    }

    public onPartUpdate(part: Part, pos: DocumentPosition): Promise<void> {
        this.partIndex = pos.index;
        return this.updateQuery(part.text);
    }

    public onComponentConfirm(completion: ICompletion): void {
        this.updateCallback({
            replaceParts: this.partForCompletion(completion),
            close: true,
        });
    }

    private partForCompletion(completion: ICompletion): Part[] {
        const { completionId } = completion;
        const text = completion.completion;
        switch (completion.type) {
            case "room":
                return [this.partCreator.roomPill(text, completionId), this.partCreator.plain(completion.suffix || "")];
            case "at-room":
                return [
                    this.partCreator.atRoomPill(completionId || ""),
                    this.partCreator.plain(completion.suffix || ""),
                ];
            case "user":
                // Insert suffix only if the pill is the part with index 0 - we are at the start of the composer
                return this.partCreator.createMentionParts(this.partIndex === 0, text, completionId || "");
            case "command":
                // command needs special handling for auto complete, but also renders as plain texts
                return [(this.partCreator as CommandPartCreator).command(text)];
            default:
                // used for emoji and other plain text completion replacement
                return this.partCreator.plainWithEmoji(text);
        }
    }
}
