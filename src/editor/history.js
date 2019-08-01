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
    }

    _shouldPush(inputType, diff) {
        if (inputType === "insertText") {
            if (diff.removed) {
                // always append when removing text
                return true;
            }
            if (diff.added) {
                this._newlyTypedCharCount += diff.added.length;
                return this._newlyTypedCharCount > MAX_STEP_LENGTH;
            }
        } else {
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
