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

export default class Range {
    constructor(model, startPosition, endPosition = startPosition) {
        this._model = model;
        this._start = startPosition;
        this._end = endPosition;
    }

    moveStart(delta) {
        this._start = this._start.forwardsWhile(this._model, () => {
            delta -= 1;
            return delta >= 0;
        });
    }

    expandBackwardsWhile(predicate) {
        this._start = this._start.backwardsWhile(this._model, predicate);
    }

    get text() {
        let text = "";
        this._start.iteratePartsBetween(this._end, this._model, (part, startIdx, endIdx) => {
            const t = part.text.substring(startIdx, endIdx);
            text = text + t;
        });
        return text;
    }

    replace(parts) {
        const newLength = parts.reduce((sum, part) => sum + part.text.length, 0);
        let oldLength = 0;
        this._start.iteratePartsBetween(this._end, this._model, (part, startIdx, endIdx) => {
            oldLength += endIdx - startIdx;
        });
        this._model.replaceRange(this._start, this._end, parts);
        return newLength - oldLength;
    }
}
