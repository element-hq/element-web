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

    serializeParts() {
        return this._parts.map(({type, text}) => {return {type, text};});
    }

    _diff(newValue, inputType, caret) {
        // handle deleteContentForward (Delete key)
        // and deleteContentBackward (Backspace)
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
        const position = this._positionForOffset(diff.at, caret.atNodeEnd);
        console.log("update at", {position, diff, newValue, prevValue: this.parts.reduce((text, p) => text + p.text, "")});
        if (diff.removed) {
            this._removeText(position, diff.removed.length);
        }
        if (diff.added) {
            this._addText(position, diff.added);
        }
        this._mergeAdjacentParts();
        // TODO: now that parts can be outright deleted, this doesn't make sense anymore
        const caretOffset = diff.at + (diff.added ? diff.added.length : 0);
        const newPosition = this._positionForOffset(caretOffset, true);
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

    _onAutoComplete = ({replacePart, replaceCaret, close}) => {
        if (replacePart) {
            this._replacePart(this._autoCompletePartIdx, replacePart);
        }
        const index = this._autoCompletePartIdx;
        if (close) {
            this._autoComplete = null;
            this._autoCompletePartIdx = null;
        }
        this._updateCallback(new DocumentPosition(index, replaceCaret));
    }

    /*
    updateCaret(caret) {
        // update active part here as well, hiding/showing autocomplete if needed
    }
    */

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

    _removeText(pos, len) {
        let {index, offset} = pos;
        while (len > 0) {
            // part might be undefined here
            let part = this._parts[index];
            if (part.canEdit) {
                const amount = Math.min(len, part.text.length - offset);
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
                len -= amount;
                offset = 0;
            } else {
                len = part.length - (offset + len);
                this._removePart(index);
            }
        }
    }

    _addText(pos, str, actions) {
        let {index, offset} = pos;
        const part = this._parts[index];
        if (part) {
            if (part.canEdit) {
                if (part.insertAll(offset, str)) {
                    str = null;
                } else {
                    // console.log("splitting", offset, [part.text]);
                    const splitPart = part.split(offset);
                    // console.log("splitted", [part.text, splitPart.text]);
                    index += 1;
                    this._insertPart(index, splitPart);
                }
            } else {
                // insert str after this part
                index += 1;
            }
        }
        while (str) {
            const newPart = this._partCreator.createPartForInput(str);
            str = newPart.appendUntilRejected(str);
            this._insertPart(index, newPart);
            index += 1;
        }
    }

    _positionForOffset(totalOffset, atPartEnd) {
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
