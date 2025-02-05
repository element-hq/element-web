/*
Copyright 2024 New Vector Ltd.
Copyright 2019 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import type EditorModel from "./model";
import type DocumentPosition from "./position";

export default class DocumentOffset {
    public constructor(
        public offset: number,
        public readonly atNodeEnd: boolean,
    ) {}

    public asPosition(model: EditorModel): DocumentPosition {
        return model.positionForOffset(this.offset, this.atNodeEnd);
    }

    public add(delta: number, atNodeEnd = false): DocumentOffset {
        return new DocumentOffset(this.offset + delta, atNodeEnd);
    }
}
