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
import DocumentPosition from "./position";

export default class DocumentOffset {
    public constructor(public offset: number, public readonly atNodeEnd: boolean) {}

    public asPosition(model: EditorModel): DocumentPosition {
        return model.positionForOffset(this.offset, this.atNodeEnd);
    }

    public add(delta: number, atNodeEnd = false): DocumentOffset {
        return new DocumentOffset(this.offset + delta, atNodeEnd);
    }
}
