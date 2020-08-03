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

import {diffAtCaret, diffDeletion, IDiff} from "./diff";
import DocumentPosition, {IPosition} from "./position";
import Range from "./range";
import {SerializedPart, Part, PartCreator} from "./parts";
import AutocompleteWrapperModel, {ICallback} from "./autocomplete";
import DocumentOffset from "./offset";
import {Caret} from "./caret";

/**
 * @callback ModelCallback
 * @param {DocumentPosition?} caretPosition the position where the caret should be position
 * @param {string?} inputType the inputType of the DOM input event
 * @param {object?} diff an object with `removed` and `added` strings
 */

/**
 * @callback TransformCallback
 * @param {DocumentPosition?} caretPosition the position where the caret should be position
 * @param {string?} inputType the inputType of the DOM input event
 * @param {object?} diff an object with `removed` and `added` strings
 * @return {Number?} addedLen how many characters were added/removed (-) before the caret during the transformation step.
 *    This is used to adjust the caret position.
 */

/**
 * @callback ManualTransformCallback
 * @return the caret position
 */

type TransformCallback = (caretPosition: DocumentPosition, inputType: string, diff: IDiff) => number | void;
type UpdateCallback = (caret: Caret, inputType?: string, diff?: IDiff) => void;
type ManualTransformCallback = () => Caret;

export default class EditorModel {
    private _parts: Part[];
    private readonly _partCreator: PartCreator;
    private activePartIdx: number = null;
    private _autoComplete: AutocompleteWrapperModel = null;
    private autoCompletePartIdx: number = null;
    private autoCompletePartCount = 0;
    private transformCallback: TransformCallback = null;

    constructor(parts: Part[], partCreator: PartCreator, private updateCallback: UpdateCallback = null) {
        this._parts = parts;
        this._partCreator = partCreator;
        this.transformCallback = null;
    }

    /**
     * Set a callback for the transformation step.
     * While processing an update, right before calling the update callback,
     * a transform callback can be called, which serves to do modifications
     * on the model that can span multiple parts. Also see `startRange()`.
     * @param {TransformCallback} transformCallback
     */
    setTransformCallback(transformCallback: TransformCallback) {
        this.transformCallback = transformCallback;
    }

    /**
     * Set a callback for rerendering the model after it has been updated.
     * @param {ModelCallback} updateCallback
     */
    setUpdateCallback(updateCallback: UpdateCallback) {
        this.updateCallback = updateCallback;
    }

    get partCreator() {
        return this._partCreator;
    }

    get isEmpty() {
        return this._parts.reduce((len, part) => len + part.text.length, 0) === 0;
    }

    clone() {
        return new EditorModel(this._parts, this._partCreator, this.updateCallback);
    }

    private insertPart(index: number, part: Part) {
        this._parts.splice(index, 0, part);
        if (this.activePartIdx >= index) {
            ++this.activePartIdx;
        }
        if (this.autoCompletePartIdx >= index) {
            ++this.autoCompletePartIdx;
        }
    }

    private removePart(index: number) {
        this._parts.splice(index, 1);
        if (index === this.activePartIdx) {
            this.activePartIdx = null;
        } else if (this.activePartIdx > index) {
            --this.activePartIdx;
        }
        if (index === this.autoCompletePartIdx) {
            this.autoCompletePartIdx = null;
        } else if (this.autoCompletePartIdx > index) {
            --this.autoCompletePartIdx;
        }
    }

    private replacePart(index: number, part: Part) {
        this._parts.splice(index, 1, part);
    }

    get parts() {
        return this._parts;
    }

    get autoComplete() {
        if (this.activePartIdx === this.autoCompletePartIdx) {
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
            // part index -1, as there are no parts to point at
            return new DocumentPosition(-1, 0);
        }
    }

    serializeParts() {
        return this._parts.map(p => p.serialize());
    }

    private diff(newValue: string, inputType: string, caret: DocumentOffset) {
        const previousValue = this.parts.reduce((text, p) => text + p.text, "");
        // can't use caret position with drag and drop
        if (inputType === "deleteByDrag") {
            return diffDeletion(previousValue, newValue);
        } else {
            return diffAtCaret(previousValue, newValue, caret.offset);
        }
    }

    reset(serializedParts: SerializedPart[], caret: Caret, inputType: string) {
        this._parts = serializedParts.map(p => this._partCreator.deserializePart(p));
        if (!caret) {
            caret = this.getPositionAtEnd();
        }
        // close auto complete if open
        // this would happen when clearing the composer after sending
        // a message with the autocomplete still open
        if (this._autoComplete) {
            this._autoComplete = null;
            this.autoCompletePartIdx = null;
        }
        this.updateCallback(caret, inputType);
    }

    /**
     * Inserts the given parts at the given position.
     * Should be run inside a `model.transform()` callback.
     * @param {Part[]} parts the parts to replace the range with
     * @param {DocumentPosition} position the position to start inserting at
     * @return {Number} the amount of characters added
     */
    insert(parts: Part[], position: IPosition) {
        const insertIndex = this.splitAt(position);
        let newTextLength = 0;
        for (let i = 0; i < parts.length; ++i) {
            const part = parts[i];
            newTextLength += part.text.length;
            this.insertPart(insertIndex + i, part);
        }
        return newTextLength;
    }

    update(newValue: string, inputType: string, caret: DocumentOffset) {
        const diff = this.diff(newValue, inputType, caret);
        const position = this.positionForOffset(diff.at, caret.atNodeEnd);
        let removedOffsetDecrease = 0;
        if (diff.removed) {
            removedOffsetDecrease = this.removeText(position, diff.removed.length);
        }
        let addedLen = 0;
        if (diff.added) {
            addedLen = this.addText(position, diff.added, inputType);
        }
        this.mergeAdjacentParts();
        const caretOffset = diff.at - removedOffsetDecrease + addedLen;
        let newPosition = this.positionForOffset(caretOffset, true);
        const canOpenAutoComplete = inputType !== "insertFromPaste" && inputType !== "insertFromDrop";
        const acPromise = this.setActivePart(newPosition, canOpenAutoComplete);
        if (this.transformCallback) {
            const transformAddedLen = this.getTransformAddedLen(newPosition, inputType, diff);
            newPosition = this.positionForOffset(caretOffset + transformAddedLen, true);
        }
        this.updateCallback(newPosition, inputType, diff);
        return acPromise;
    }

    private getTransformAddedLen(newPosition: DocumentPosition, inputType: string, diff: IDiff): number {
        const result = this.transformCallback(newPosition, inputType, diff);
        return Number.isFinite(result) ? result as number : 0;
    }

    private setActivePart(pos: DocumentPosition, canOpenAutoComplete: boolean) {
        const {index} = pos;
        const part = this._parts[index];
        if (part) {
            if (index !== this.activePartIdx) {
                this.activePartIdx = index;
                if (canOpenAutoComplete && this.activePartIdx !== this.autoCompletePartIdx) {
                    // else try to create one
                    const ac = part.createAutoComplete(this.onAutoComplete);
                    if (ac) {
                        // make sure that react picks up the difference between both acs
                        this._autoComplete = ac;
                        this.autoCompletePartIdx = index;
                        this.autoCompletePartCount = 1;
                    }
                }
            }
            // not _autoComplete, only there if active part is autocomplete part
            if (this.autoComplete) {
                return this.autoComplete.onPartUpdate(part, pos);
            }
        } else {
            this.activePartIdx = null;
            this._autoComplete = null;
            this.autoCompletePartIdx = null;
            this.autoCompletePartCount = 0;
        }
        return Promise.resolve();
    }

    private onAutoComplete = ({replaceParts, close}: ICallback) => {
        let pos;
        if (replaceParts) {
            this._parts.splice(this.autoCompletePartIdx, this.autoCompletePartCount, ...replaceParts);
            this.autoCompletePartCount = replaceParts.length;
            const lastPart = replaceParts[replaceParts.length - 1];
            const lastPartIndex = this.autoCompletePartIdx + replaceParts.length - 1;
            pos = new DocumentPosition(lastPartIndex, lastPart.text.length);
        }
        if (close) {
            this._autoComplete = null;
            this.autoCompletePartIdx = null;
            this.autoCompletePartCount = 0;
        }
        // rerender even if editor contents didn't change
        // to make sure the MessageEditor checks
        // model.autoComplete being empty and closes it
        this.updateCallback(pos);
    };

    private mergeAdjacentParts() {
        let prevPart;
        for (let i = 0; i < this._parts.length; ++i) {
            let part = this._parts[i];
            const isEmpty = !part.text.length;
            const isMerged = !isEmpty && prevPart && prevPart.merge(part);
            if (isEmpty || isMerged) {
                // remove empty or merged part
                part = prevPart;
                this.removePart(i);
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
    removeText(pos: IPosition, len: number) {
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
                        this.replacePart(index, this._partCreator.createDefaultPart(replaceWith));
                    }
                    part = this._parts[index];
                    // remove empty part
                    if (!part.text.length) {
                        this.removePart(index);
                    } else {
                        index += 1;
                    }
                } else {
                    removedOffsetDecrease += offset;
                    this.removePart(index);
                }
            } else {
                index += 1;
            }
            len -= amount;
            offset = 0;
        }
        return removedOffsetDecrease;
    }

    // return part index where insertion will insert between at offset
    private splitAt(pos: IPosition) {
        if (pos.index === -1) {
            return 0;
        }
        if (pos.offset === 0) {
            return pos.index;
        }
        const part = this._parts[pos.index];
        if (pos.offset >= part.text.length) {
            return pos.index + 1;
        }

        const secondPart = part.split(pos.offset);
        this.insertPart(pos.index + 1, secondPart);
        return pos.index + 1;
    }

    /**
     * inserts `str` into the model at `pos`.
     * @param {Object} pos
     * @param {string} str
     * @param {string} inputType the source of the input, see html InputEvent.inputType
     * @param {bool} options.validate Whether characters will be validated by the part.
     *                                Validating allows the inserted text to be parsed according to the part rules.
     * @return {Number} how far from position (in characters) the insertion ended.
     * This can be more than the length of `str` when crossing non-editable parts, which are skipped.
     */
    private addText(pos: IPosition, str: string, inputType: string) {
        let {index} = pos;
        const {offset} = pos;
        let addLen = str.length;
        const part = this._parts[index];
        if (part) {
            if (part.canEdit) {
                if (part.validateAndInsert(offset, str, inputType)) {
                    str = null;
                } else {
                    const splitPart = part.split(offset);
                    index += 1;
                    this.insertPart(index, splitPart);
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
            const newPart = this._partCreator.createPartForInput(str, index, inputType);
            str = newPart.appendUntilRejected(str, inputType);
            this.insertPart(index, newPart);
            index += 1;
        }
        return addLen;
    }

    positionForOffset(totalOffset: number, atPartEnd: boolean) {
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
        if (index === -1) {
            return this.getPositionAtEnd();
        } else {
            return new DocumentPosition(index, totalOffset - currentOffset);
        }
    }

    /**
     * Starts a range, which can span across multiple parts, to find and replace text.
     * @param {DocumentPosition} positionA a boundary of the range
     * @param {DocumentPosition?} positionB the other boundary of the range, optional
     * @return {Range}
     */
    startRange(positionA: DocumentPosition, positionB = positionA) {
        return new Range(this, positionA, positionB);
    }

    replaceRange(startPosition: DocumentPosition, endPosition: DocumentPosition, parts: Part[]) {
        // convert end position to offset, so it is independent of how the document is split into parts
        // which we'll change when splitting up at the start position
        const endOffset = endPosition.asOffset(this);
        const newStartPartIndex = this.splitAt(startPosition);
        // convert it back to position once split at start
        endPosition = endOffset.asPosition(this);
        const newEndPartIndex = this.splitAt(endPosition);
        for (let i = newEndPartIndex - 1; i >= newStartPartIndex; --i) {
            this.removePart(i);
        }
        let insertIdx = newStartPartIndex;
        for (const part of parts) {
            this.insertPart(insertIdx, part);
            insertIdx += 1;
        }
        this.mergeAdjacentParts();
    }

    /**
     * Performs a transformation not part of an update cycle.
     * Modifying the model should only happen inside a transform call if not part of an update call.
     * @param {ManualTransformCallback} callback to run the transformations in
     * @return {Promise} a promise when auto-complete (if applicable) is done updating
     */
    transform(callback: ManualTransformCallback) {
        const pos = callback();
        let acPromise = null;
        if (!(pos instanceof Range)) {
            acPromise = this.setActivePart(pos, true);
        } else {
            acPromise = Promise.resolve();
        }
        this.updateCallback(pos);
        return acPromise;
    }
}
