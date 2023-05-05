/*
Copyright 2021 The Matrix.org Foundation C.I.C.

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

import { IEventRelation, UploadProgress } from "matrix-js-sdk/src/matrix";

import { IEncryptedFile } from "../customisations/models/IMediaEventContent";

export class RoomUpload {
    public readonly abortController = new AbortController();
    public promise?: Promise<{ url?: string; file?: IEncryptedFile }>;
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
