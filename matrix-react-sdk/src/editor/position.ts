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

import DocumentOffset from "./offset";
import EditorModel from "./model";
import { Part } from "./parts";

export interface IPosition {
    index: number;
    offset: number;
}

type Callback = (part: Part, startIdx: number, endIdx: number) => void;
export type Predicate = (index: number, offset: number, part: Part) => boolean;

export default class DocumentPosition implements IPosition {
    public constructor(public readonly index: number, public readonly offset: number) {}

    public compare(otherPos: DocumentPosition): number {
        if (this.index === otherPos.index) {
            return this.offset - otherPos.offset;
        } else {
            return this.index - otherPos.index;
        }
    }

    public iteratePartsBetween(other: DocumentPosition, model: EditorModel, callback: Callback): void {
        if (this.index === -1 || other.index === -1) {
            return;
        }
        const [startPos, endPos] = this.compare(other) < 0 ? [this, other] : [other, this];
        if (startPos.index === endPos.index) {
            callback(model.parts[this.index], startPos.offset, endPos.offset);
        } else {
            const firstPart = model.parts[startPos.index];
            callback(firstPart, startPos.offset, firstPart.text.length);
            for (let i = startPos.index + 1; i < endPos.index; ++i) {
                const part = model.parts[i];
                callback(part, 0, part.text.length);
            }
            const lastPart = model.parts[endPos.index];
            callback(lastPart, 0, endPos.offset);
        }
    }

    public forwardsWhile(model: EditorModel, predicate: Predicate): DocumentPosition {
        if (this.index === -1) {
            return this;
        }

        let { index, offset } = this;
        const { parts } = model;
        while (index < parts.length) {
            const part = parts[index];
            while (offset < part.text.length) {
                if (!predicate(index, offset, part)) {
                    return new DocumentPosition(index, offset);
                }
                offset += 1;
            }
            // end reached
            if (index === parts.length - 1) {
                return new DocumentPosition(index, offset);
            } else {
                index += 1;
                offset = 0;
            }
        }

        return this; // impossible but Typescript doesn't believe us
    }

    public backwardsWhile(model: EditorModel, predicate: Predicate): DocumentPosition {
        if (this.index === -1) {
            return this;
        }

        let { index, offset } = this;
        const parts = model.parts;
        while (index >= 0) {
            const part = parts[index];
            while (offset > 0) {
                if (!predicate(index, offset - 1, part)) {
                    return new DocumentPosition(index, offset);
                }
                offset -= 1;
            }
            // start reached
            if (index === 0) {
                return new DocumentPosition(index, offset);
            } else {
                index -= 1;
                offset = parts[index].text.length;
            }
        }

        return this; // impossible but Typescript doesn't believe us
    }

    public asOffset(model: EditorModel): DocumentOffset {
        if (this.index === -1) {
            return new DocumentOffset(0, true);
        }
        let offset = 0;
        for (let i = 0; i < this.index; ++i) {
            offset += model.parts[i].text.length;
        }
        offset += this.offset;
        const lastPart = model.parts[this.index];
        const atEnd = !lastPart || offset >= lastPart.text.length; // if no last part, we're at the end
        return new DocumentOffset(offset, atEnd);
    }

    public isAtEnd(model: EditorModel): boolean {
        if (model.parts.length === 0) {
            return true;
        }
        const lastPartIdx = model.parts.length - 1;
        const lastPart = model.parts[lastPartIdx];
        return this.index === lastPartIdx && this.offset === lastPart.text.length;
    }

    public isAtStart(): boolean {
        return this.index === 0 && this.offset === 0;
    }
}
