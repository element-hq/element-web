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

import {diffAtCaret, diffDeletion} from "./diff";

export default class EditorModel {
    constructor(parts, partCreator, updateCallback) {
        this._parts = parts;
        this._partCreator = partCreator;
        this._activePartIdx = null;
        this._autoComplete = null;
        this._autoCompletePartIdx = null;
        this._updateCallback = updateCallback;
    }

    clone() {
        return new EditorModel(this._parts, this._partCreator, this._updateCallback);
    }

    _insertPart(index, part) {
        this._parts.splice(index, 0, part);
        if (this._activePartIdx >= index) {
            ++this._activePartIdx;
        }
        if (this._autoCompletePartIdx >= index) {
            ++this._autoCompletePartIdx;
        }
    }

    _removePart(index) {
        this._parts.splice(index, 1);
        if (this._activePartIdx >= index) {
            --this._activePartIdx;
        }
        if (this._autoCompletePartIdx >= index) {
            --this._autoCompletePartIdx;
        }
    }

    _replacePart(index, part) {
        this._parts.splice(index, 1, part);
    }

    get parts() {
        return this._parts;
    }

    get autoComplete() {
        if (this._activePartIdx === this._autoCompletePartIdx) {
            return this._autoComplete;
        }
        return null;
    }

    getPositionAtEnd() {
        if (this._parts.length) {
            const index = this._parts.length - 1;
            const part = this._parts[index];
            return new DocumentPosition(index, part.text.length);
        } else {
            return new DocumentPosition(0, 0);
        }
    }

    serializeParts() {
        return this._parts.map(p => p.serialize());
    }

    _diff(newValue, inputType, caret) {
        const previousValue = this.parts.reduce((text, p) => text + p.text, "");
        // can't use caret position with drag and drop
        if (inputType === "deleteByDrag") {
            return diffDeletion(previousValue, newValue);
        } else {
            return diffAtCaret(previousValue, newValue, caret.offset);
        }
    }

    update(newValue, inputType, caret) {
        const diff = this._diff(newValue, inputType, caret);
        const position = this.positionForOffset(diff.at, caret.atNodeEnd);
        let removedOffsetDecrease = 0;
        if (diff.removed) {
            removedOffsetDecrease = this.removeText(position, diff.removed.length);
        }
        let addedLen = 0;
        if (diff.added) {
            addedLen = this._addText(position, diff.added);
        }
        this._mergeAdjacentParts();
        const caretOffset = diff.at - removedOffsetDecrease + addedLen;
        let newPosition = this.positionForOffset(caretOffset, true);
        newPosition = newPosition.skipUneditableParts(this._parts);
        this._setActivePart(newPosition);
        this._updateCallback(newPosition);
    }

    _setActivePart(pos) {
        const {index} = pos;
        const part = this._parts[index];
        if (part) {
            if (index !== this._activePartIdx) {
                this._activePartIdx = index;
                if (this._activePartIdx !== this._autoCompletePartIdx) {
                    // else try to create one
                    const ac = part.createAutoComplete(this._onAutoComplete);
                    if (ac) {
                        // make sure that react picks up the difference between both acs
                        this._autoComplete = ac;
                        this._autoCompletePartIdx = index;
                    }
                }
            }
            // not _autoComplete, only there if active part is autocomplete part
            if (this.autoComplete) {
                this.autoComplete.onPartUpdate(part, pos.offset);
            }
        } else {
            this._activePartIdx = null;
            this._autoComplete = null;
            this._autoCompletePartIdx = null;
        }
    }

    _onAutoComplete = ({replacePart, caretOffset, close}) => {
        let pos;
        if (replacePart) {
            this._replacePart(this._autoCompletePartIdx, replacePart);
            let index = this._autoCompletePartIdx;
            if (caretOffset === undefined) {
                caretOffset = 0;
                index += 1;
            }
            pos = new DocumentPosition(index, caretOffset);
        }
        if (close) {
            this._autoComplete = null;
            this._autoCompletePartIdx = null;
        }
        // rerender even if editor contents didn't change
        // to make sure the MessageEditor checks
        // model.autoComplete being empty and closes it
        this._updateCallback(pos);
    }

    _mergeAdjacentParts(docPos) {
        let prevPart = this._parts[0];
        for (let i = 1; i < this._parts.length; ++i) {
            let part = this._parts[i];
            const isEmpty = !part.text.length;
            const isMerged = !isEmpty && prevPart.merge(part);
            if (isEmpty || isMerged) {
                // remove empty or merged part
                part = prevPart;
                this._removePart(i);
                //repeat this index, as it's removed now
                --i;
            }
            prevPart = part;
        }
    }

    /**
     * removes `len` amount of characters at `pos`.
     * @param {Object} pos
     * @param {Number} len
     * @return {Number} how many characters before pos were also removed,
     * usually because of non-editable parts that can only be removed in their entirety.
     */
    removeText(pos, len) {
        let {index, offset} = pos;
        let removedOffsetDecrease = 0;
        while (len > 0) {
            // part might be undefined here
            let part = this._parts[index];
            const amount = Math.min(len, part.text.length - offset);
            // don't allow 0 amount deletions
            if (amount) {
                if (part.canEdit) {
                    const replaceWith = part.remove(offset, amount);
                    if (typeof replaceWith === "string") {
                        this._replacePart(index, this._partCreator.createDefaultPart(replaceWith));
                    }
                    part = this._parts[index];
                    // remove empty part
                    if (!part.text.length) {
                        this._removePart(index);
                    } else {
                        index += 1;
                    }
                } else {
                    removedOffsetDecrease += offset;
                    this._removePart(index);
                }
            } else {
                index += 1;
            }
            len -= amount;
            offset = 0;
        }
        return removedOffsetDecrease;
    }

    /**
     * inserts `str` into the model at `pos`.
     * @param {Object} pos
     * @param {string} str
     * @return {Number} how far from position (in characters) the insertion ended.
     * This can be more than the length of `str` when crossing non-editable parts, which are skipped.
     */
    _addText(pos, str) {
        let {index} = pos;
        const {offset} = pos;
        let addLen = str.length;
        const part = this._parts[index];
        if (part) {
            if (part.canEdit) {
                if (part.insertAll(offset, str)) {
                    str = null;
                } else {
                    const splitPart = part.split(offset);
                    index += 1;
                    this._insertPart(index, splitPart);
                }
            } else if (offset !== 0) {
                // not-editable part, caret is not at start,
                // so insert str after this part
                addLen += part.text.length - offset;
                index += 1;
            }
        }
        while (str) {
            const newPart = this._partCreator.createPartForInput(str);
            str = newPart.appendUntilRejected(str);
            this._insertPart(index, newPart);
            index += 1;
        }
        return addLen;
    }

    positionForOffset(totalOffset, atPartEnd) {
        let currentOffset = 0;
        const index = this._parts.findIndex(part => {
            const partLen = part.text.length;
            if (
                (atPartEnd && (currentOffset + partLen) >= totalOffset) ||
                (!atPartEnd && (currentOffset + partLen) > totalOffset)
            ) {
                return true;
            }
            currentOffset += partLen;
            return false;
        });

        return new DocumentPosition(index, totalOffset - currentOffset);
    }
}

class DocumentPosition {
    constructor(index, offset) {
        this._index = index;
        this._offset = offset;
    }

    get index() {
        return this._index;
    }

    get offset() {
        return this._offset;
    }

    skipUneditableParts(parts) {
        const part = parts[this.index];
        if (part && !part.canEdit) {
            return new DocumentPosition(this.index + 1, 0);
        } else {
            return this;
        }
    }
}
