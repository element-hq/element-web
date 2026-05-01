/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import {
    type ComposerApi as ModuleComposerApi,
    type ComposerApiFileUploadOption,
} from "@element-hq/element-web-module-api";
import { TypedEventEmitter } from "matrix-js-sdk/src/matrix";

import type { MatrixDispatcher } from "../dispatcher/dispatcher";
import { Action } from "../dispatcher/actions";
import type { ComposerInsertPayload } from "../dispatcher/payloads/ComposerInsertPayload";

export enum ModuleComposerApiEvents {
    UploaderOptionsChanged = "uploaderOptionsChanged",
}

interface ModuleComposerApiEventsMap {
    [ModuleComposerApiEvents.UploaderOptionsChanged]: (option: ComposerApiFileUploadOption) => void;
}

export class ComposerApi
    extends TypedEventEmitter<ModuleComposerApiEvents, ModuleComposerApiEventsMap>
    implements ModuleComposerApi
{
    private allowLocalFileUploads = true;
    private readonly configuredFileUploadOptions = new Map<string, ComposerApiFileUploadOption>();

    public constructor(private readonly dispatcher: MatrixDispatcher) {
        super();
    }

    /**
     * Is the user permitted to upload local files in any way.
     */
    public get localFileUploadsAllowed(): boolean {
        return this.allowLocalFileUploads;
    }

    /**
     * List of possible file upload options.
     */
    public get fileUploadOptions(): ComposerApiFileUploadOption[] {
        return [...this.configuredFileUploadOptions.values()];
    }

    public disableLocalFileUploads(): void {
        this.allowLocalFileUploads = false;
    }

    public addFileUploadOption(option: ComposerApiFileUploadOption): void {
        if (this.configuredFileUploadOptions.has(option.type)) {
            throw new Error(`Option "${option.type}" already exists `);
        }
        this.configuredFileUploadOptions.set(option.type, option);
        this.emit(ModuleComposerApiEvents.UploaderOptionsChanged, option);
    }

    public openFileUploadConfirmation(files: File[]): void {
        this.dispatcher.dispatch({
            action: Action.ComposerInsert,
            files,
        } satisfies ComposerInsertPayload);
    }

    public insertPlaintextIntoComposer(plaintext: string): void {
        this.dispatcher.dispatch({
            action: Action.ComposerInsert,
            text: plaintext,
        } satisfies ComposerInsertPayload);
    }
}
