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
        this.setUpdateCallback(updateCallback);
    }

    setUpdateCallback(updateCallback) {
        this._updateCallback = updateCallback;
    }

    get partCreator() {
        return this._partCreator;
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

    reset(serializedParts, caret, inputType) {
        this._parts = serializedParts.map(p => this._partCreator.deserializePart(p));
        this._updateCallback(caret, inputType);
    }

    update(newValue, inputType, caret) {
        const diff = this._diff(newValue, inputType, caret);
        const position = this.positionForOffset(diff.at, caret.atNodeEnd);
        let removedOffsetDecrease = 0;
        if (diff.removed) {
            removedOffsetDecrease = this.removeText(position, diff.removed.length);
        }
        const canOpenAutoComplete = inputType !== "insertFromPaste" && inputType !== "insertFromDrop";
        let addedLen = 0;
        if (diff.added) {
            // these shouldn't trigger auto-complete, you just want to append a piece of text
            addedLen = this._addText(position, diff.added, {validate: canOpenAutoComplete});
        }
        this._mergeAdjacentParts();
        const caretOffset = diff.at - removedOffsetDecrease + addedLen;
        const newPosition = this.positionForOffset(caretOffset, true);
        this._setActivePart(newPosition, canOpenAutoComplete);
        this._updateCallback(newPosition, inputType, diff);
    }

    _setActivePart(pos, canOpenAutoComplete) {
        const {index} = pos;
        const part = this._parts[index];
        if (part) {
            if (index !== this._activePartIdx) {
                this._activePartIdx = index;
                if (canOpenAutoComplete && this._activePartIdx !== this._autoCompletePartIdx) {
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
            const index = this._autoCompletePartIdx;
            if (caretOffset === undefined) {
                caretOffset = replacePart.text.length;
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
        let prevPart;
        for (let i = 0; i < this._parts.length; ++i) {
            let part = this._parts[i];
            const isEmpty = !part.text.length;
            const isMerged = !isEmpty && prevPart && prevPart.merge(part);
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
     * @param {Object} options
     * @param {bool} options.validate Whether characters will be validated by the part.
     *                                Validating allows the inserted text to be parsed according to the part rules.
     * @return {Number} how far from position (in characters) the insertion ended.
     * This can be more than the length of `str` when crossing non-editable parts, which are skipped.
     */
    _addText(pos, str, {validate=true}) {
        let {index} = pos;
        const {offset} = pos;
        let addLen = str.length;
        const part = this._parts[index];
        if (part) {
            if (part.canEdit) {
                if (validate && part.validateAndInsert(offset, str)) {
                    str = null;
                } else if (!validate && part.insert(offset, str)) {
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
        } else if (index < 0) {
            // if position was not found (index: -1, as happens for empty editor)
            // reset it to insert as first part
            index = 0;
        }
        while (str) {
            const newPart = this._partCreator.createPartForInput(str);
            if (validate) {
                str = newPart.appendUntilRejected(str);
            } else {
                newPart.insert(0, str);
                str = null;
            }
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
}
