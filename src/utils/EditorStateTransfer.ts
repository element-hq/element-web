/*
Copyright 2024 New Vector Ltd.
Copyright 2019-2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type MatrixEvent } from "matrix-js-sdk/src/matrix";

import { type SerializedPart } from "../editor/parts";
import type DocumentOffset from "../editor/offset";

/**
 * Used while editing, to pass the event, and to preserve editor state
 * from one editor instance to another when remounting the editor
 * upon receiving the remote echo for an unsent event.
 */
export default class EditorStateTransfer {
    private serializedParts: SerializedPart[] | null = null;
    private caret: DocumentOffset | null = null;

    public constructor(private readonly event: MatrixEvent) {}

    public setEditorState(caret: DocumentOffset | null, serializedParts: SerializedPart[]): void {
        this.caret = caret;
        this.serializedParts = serializedParts;
    }

    public hasEditorState(): boolean {
        return !!this.serializedParts;
    }

    public getSerializedParts(): SerializedPart[] | null {
        return this.serializedParts;
    }

    public getCaret(): DocumentOffset | null {
        return this.caret;
    }

    public getEvent(): MatrixEvent {
        return this.event;
    }
}
