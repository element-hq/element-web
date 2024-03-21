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

import EditorModel from "./model";
import { IDiff } from "./diff";
import { SerializedPart } from "./parts";
import { Caret } from "./caret";

export interface IHistory {
    parts: SerializedPart[];
    caret?: Caret;
}

export const MAX_STEP_LENGTH = 10;

export default class HistoryManager {
    private stack: IHistory[] = [];
    private newlyTypedCharCount = 0;
    private currentIndex = -1;
    private changedSinceLastPush = false;
    private lastCaret?: Caret;
    private nonWordBoundarySinceLastPush = false;
    private addedSinceLastPush = false;
    private removedSinceLastPush = false;

    public clear(): void {
        this.stack = [];
        this.newlyTypedCharCount = 0;
        this.currentIndex = -1;
        this.changedSinceLastPush = false;
        this.lastCaret = undefined;
        this.nonWordBoundarySinceLastPush = false;
        this.addedSinceLastPush = false;
        this.removedSinceLastPush = false;
    }

    private shouldPush(inputType?: string, diff?: IDiff): boolean {
        // right now we can only push a step after
        // the input has been applied to the model,
        // so we can't push the state before something happened.
        // not ideal but changing this would be harder to fit cleanly into
        // the editor model.
        const isNonBulkInput =
            inputType === "insertText" || inputType === "deleteContentForward" || inputType === "deleteContentBackward";
        if (diff && isNonBulkInput) {
            if (diff.added) {
                this.addedSinceLastPush = true;
            }
            if (diff.removed) {
                this.removedSinceLastPush = true;
            }
            // as long as you've only been adding or removing since the last push
            if (this.addedSinceLastPush !== this.removedSinceLastPush) {
                // add steps by word boundary, up to MAX_STEP_LENGTH characters
                const str = diff.added ? diff.added : diff.removed!;
                const isWordBoundary = str === " " || str === "\t" || str === "\n";
                if (this.nonWordBoundarySinceLastPush && isWordBoundary) {
                    return true;
                }
                if (!isWordBoundary) {
                    this.nonWordBoundarySinceLastPush = true;
                }
                this.newlyTypedCharCount += str.length;
                return this.newlyTypedCharCount > MAX_STEP_LENGTH;
            } else {
                // if starting to remove while adding before, or the opposite, push
                return true;
            }
        } else {
            // bulk input (paste, ...) should be pushed every time
            return true;
        }
    }

    private pushState(model: EditorModel, caret?: Caret): void {
        // remove all steps after current step
        while (this.currentIndex < this.stack.length - 1) {
            this.stack.pop();
        }
        const parts = model.serializeParts();
        this.stack.push({ parts, caret });
        this.currentIndex = this.stack.length - 1;
        this.lastCaret = undefined;
        this.changedSinceLastPush = false;
        this.newlyTypedCharCount = 0;
        this.nonWordBoundarySinceLastPush = false;
        this.addedSinceLastPush = false;
        this.removedSinceLastPush = false;
    }

    // needs to persist parts and caret position
    public tryPush(model: EditorModel, caret?: Caret, inputType?: string, diff?: IDiff): boolean {
        // ignore state restoration echos.
        // these respect the inputType values of the input event,
        // but are actually passed in from MessageEditor calling model.reset()
        // in the keydown event handler.
        if (inputType === "historyUndo" || inputType === "historyRedo") {
            return false;
        }
        const shouldPush = this.shouldPush(inputType, diff);
        if (shouldPush) {
            this.pushState(model, caret);
        } else {
            this.lastCaret = caret;
            this.changedSinceLastPush = true;
        }
        return shouldPush;
    }

    public ensureLastChangesPushed(model: EditorModel): void {
        if (this.changedSinceLastPush && this.lastCaret) {
            this.pushState(model, this.lastCaret);
        }
    }

    public canUndo(): boolean {
        return this.currentIndex >= 1 || this.changedSinceLastPush;
    }

    public canRedo(): boolean {
        return this.currentIndex < this.stack.length - 1;
    }

    // returns state that should be applied to model
    public undo(model: EditorModel): IHistory | void {
        if (this.canUndo()) {
            this.ensureLastChangesPushed(model);
            this.currentIndex -= 1;
            return this.stack[this.currentIndex];
        }
    }

    // returns state that should be applied to model
    public redo(): IHistory | void {
        if (this.canRedo()) {
            this.changedSinceLastPush = false;
            this.currentIndex += 1;
            return this.stack[this.currentIndex];
        }
    }
}
