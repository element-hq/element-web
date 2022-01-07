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
import DocumentPosition, { Predicate } from "./position";
import { Part } from "./parts";

const whitespacePredicate: Predicate = (index, offset, part) => {
    return part.text[offset].trim() === "";
};

export default class Range {
    private _start: DocumentPosition;
    private _end: DocumentPosition;

    constructor(public readonly model: EditorModel, positionA: DocumentPosition, positionB = positionA) {
        const bIsLarger = positionA.compare(positionB) < 0;
        this._start = bIsLarger ? positionA : positionB;
        this._end = bIsLarger ? positionB : positionA;
    }

    public moveStartForwards(delta: number): void {
        this._start = this._start.forwardsWhile(this.model, () => {
            delta -= 1;
            return delta >= 0;
        });
    }

    public moveEndBackwards(delta: number): void {
        this._end = this._end.backwardsWhile(this.model, () => {
            delta -= 1;
            return delta >= 0;
        });
    }

    public trim(): void {
        this._start = this._start.forwardsWhile(this.model, whitespacePredicate);
        this._end = this._end.backwardsWhile(this.model, whitespacePredicate);
    }

    public expandBackwardsWhile(predicate: Predicate): void {
        this._start = this._start.backwardsWhile(this.model, predicate);
    }

    public get text(): string {
        let text = "";
        this._start.iteratePartsBetween(this._end, this.model, (part, startIdx, endIdx) => {
            const t = part.text.substring(startIdx, endIdx);
            text = text + t;
        });
        return text;
    }

    /**
     * Splits the model at the range boundaries and replaces with the given parts.
     * Should be run inside a `model.transform()` callback.
     * @param {Part[]} parts the parts to replace the range with
     * @return {Number} the net amount of characters added, can be negative.
     */
    public replace(parts: Part[]): number {
        const newLength = parts.reduce((sum, part) => sum + part.text.length, 0);
        let oldLength = 0;
        this._start.iteratePartsBetween(this._end, this.model, (part, startIdx, endIdx) => {
            oldLength += endIdx - startIdx;
        });
        this.model.replaceRange(this._start, this._end, parts);
        return newLength - oldLength;
    }

    /**
     * Returns a copy of the (partial) parts within the range.
     * For partial parts, only the text is adjusted to the part that intersects with the range.
     */
    public get parts(): Part[] {
        const parts: Part[] = [];
        this._start.iteratePartsBetween(this._end, this.model, (part, startIdx, endIdx) => {
            const serializedPart = part.serialize();
            serializedPart.text = part.text.substring(startIdx, endIdx);
            const newPart = this.model.partCreator.deserializePart(serializedPart);
            parts.push(newPart);
        });
        return parts;
    }

    public get length(): number {
        let len = 0;
        this._start.iteratePartsBetween(this._end, this.model, (part, startIdx, endIdx) => {
            len += endIdx - startIdx;
        });
        return len;
    }

    public get start(): DocumentPosition {
        return this._start;
    }

    public get end(): DocumentPosition {
        return this._end;
    }
}
