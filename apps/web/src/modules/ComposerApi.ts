/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type ComposerApi as ModuleComposerApi } from "@element-hq/element-web-module-api";

import type { MatrixDispatcher } from "../dispatcher/dispatcher";
import { Action } from "../dispatcher/actions";
import type { ComposerInsertPayload } from "../dispatcher/payloads/ComposerInsertPayload";

export class ComposerApi implements ModuleComposerApi {
    private allowLocalFileUploads = true;

    public constructor(private readonly dispatcher: MatrixDispatcher) {}

    public get localFileUploadsAllowed(): boolean {
        return this.allowLocalFileUploads;
    }

    public addFileUploadOption(option): void {}

    public disableLocalFileUploads(): void {
        this.allowLocalFileUploads = false;
    }

    public insertPlaintextIntoComposer(plaintext: string): void {
        this.dispatcher.dispatch({
            action: Action.ComposerInsert,
            text: plaintext,
        } satisfies ComposerInsertPayload);
    }
}
