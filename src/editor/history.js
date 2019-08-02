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

export const MAX_STEP_LENGTH = 10;

export default class HistoryManager {
    constructor() {
        this._stack = [];
        this._newlyTypedCharCount = 0;
        this._currentIndex = -1;
        this._changedSinceLastPush = false;
        this._lastCaret = null;
        this._nonWordBoundarySinceLastPush = false;
        this._addedSinceLastPush = false;
        this._removedSinceLastPush = false;
    }

    _shouldPush(inputType, diff) {
        // right now we can only push a step after
        // the input has been applied to the model,
        // so we can't push the state before something happened.
        // not ideal but changing this would be harder to fit cleanly into
        // the editor model.
        const isNonBulkInput = inputType === "insertText" ||
                               inputType === "deleteContentForward" ||
                               inputType === "deleteContentBackward";
        if (diff && isNonBulkInput) {
            if (diff.added) {
                this._addedSinceLastPush = true;
            }
            if (diff.removed) {
                this._removedSinceLastPush = true;
            }
            // as long as you've only been adding or removing since the last push
            if (this._addedSinceLastPush !== this._removedSinceLastPush) {
                // add steps by word boundary, up to MAX_STEP_LENGTH characters
                const str = diff.added ? diff.added : diff.removed;
                const isWordBoundary = str === " " || str === "\t" || str === "\n";
                if (this._nonWordBoundarySinceLastPush && isWordBoundary) {
                    return true;
                }
                if (!isWordBoundary) {
                    this._nonWordBoundarySinceLastPush = true;
                }
                this._newlyTypedCharCount += str.length;
                return this._newlyTypedCharCount > MAX_STEP_LENGTH;
            } else {
                // if starting to remove while adding before, or the opposite, push
                return true;
            }
        } else {
            // bulk input (paste, ...) should be pushed every time
            return true;
        }
    }

    _pushState(model, caret) {
        // remove all steps after current step
        while (this._currentIndex < (this._stack.length - 1)) {
            this._stack.pop();
        }
        const parts = model.serializeParts();
        this._stack.push({parts, caret});
        this._currentIndex = this._stack.length - 1;
        this._lastCaret = null;
        this._changedSinceLastPush = false;
        this._newlyTypedCharCount = 0;
        this._nonWordBoundarySinceLastPush = false;
        this._addedSinceLastPush = false;
        this._removedSinceLastPush = false;
    }

    // needs to persist parts and caret position
    tryPush(model, caret, inputType, diff) {
        // ignore state restoration echos.
        // these respect the inputType values of the input event,
        // but are actually passed in from MessageEditor calling model.reset()
        // in the keydown event handler.
        if (inputType === "historyUndo" || inputType === "historyRedo") {
            return false;
        }
        const shouldPush = this._shouldPush(inputType, diff);
        if (shouldPush) {
            this._pushState(model, caret);
        } else {
            this._lastCaret = caret;
            this._changedSinceLastPush = true;
        }
        return shouldPush;
    }

    canUndo() {
        return this._currentIndex >= 1 || this._changedSinceLastPush;
    }

    canRedo() {
        return this._currentIndex < (this._stack.length - 1);
    }

    // returns state that should be applied to model
    undo(model) {
        if (this.canUndo()) {
            if (this._changedSinceLastPush) {
                this._pushState(model, this._lastCaret);
            }
            this._currentIndex -= 1;
            return this._stack[this._currentIndex];
        }
    }

    // returns state that should be applied to model
    redo() {
        if (this.canRedo()) {
            this._changedSinceLastPush = false;
            this._currentIndex += 1;
            return this._stack[this._currentIndex];
        }
    }
}
