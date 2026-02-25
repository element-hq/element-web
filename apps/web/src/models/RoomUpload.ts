/*
Copyright 2024 New Vector Ltd.
Copyright 2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type IEventRelation, type UploadProgress } from "matrix-js-sdk/src/matrix";
import { type EncryptedFile } from "matrix-js-sdk/src/types";

export class RoomUpload {
    public readonly abortController = new AbortController();
    public promise?: Promise<{ url?: string; file?: EncryptedFile }>;
    private uploaded = 0;

    public constructor(
        public readonly roomId: string,
        public readonly fileName: string,
        public readonly relation?: IEventRelation,
        public fileSize = 0,
    ) {}

    public onProgress(progress: UploadProgress): void {
        this.uploaded = progress.loaded;
        this.fileSize = progress.total;
    }

    public abort(): void {
        this.abortController.abort();
    }

    public get cancelled(): boolean {
        return this.abortController.signal.aborted;
    }

    public get total(): number {
        return this.fileSize;
    }

    public get loaded(): number {
        return this.uploaded;
    }
}
