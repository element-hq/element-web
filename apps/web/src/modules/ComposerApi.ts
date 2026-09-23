/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import {
    type ComposerApi as ModuleComposerApi,
    type ComposerApiFileUploadOption,
    type ComposerApiTarget,
} from "@element-hq/element-web-module-api";
import { TypedEventEmitter } from "matrix-js-sdk/src/matrix";

import type { MatrixDispatcher } from "../dispatcher/dispatcher";
import { Action } from "../dispatcher/actions";
import { ComposerType, type ComposerInsertPayload } from "../dispatcher/payloads/ComposerInsertPayload";
import { TimelineRenderingType } from "../contexts/RoomContext";
import type { ComposerInsertFilesPayload } from "../dispatcher/payloads/ComposerInsertFilePayload";

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
    private readonly configuredFileUploadOptions = new Map<string, ComposerApiFileUploadOption>();

    public constructor(private readonly dispatcher: MatrixDispatcher) {
        super();
    }

    /**
     * List of possible file upload options.
     */
    public get fileUploadOptions(): ComposerApiFileUploadOption[] {
        return [...this.configuredFileUploadOptions.values()];
    }

    public addFileUploadOption(option: ComposerApiFileUploadOption): void {
        if (this.configuredFileUploadOptions.has(option.type)) {
            throw new Error(`Option "${option.type}" already exists`);
        }
        if (option.type === "local") {
            throw new Error(`Option "local" is reserved`);
        }
        this.configuredFileUploadOptions.set(option.type, option);
        this.emit(ModuleComposerApiEvents.UploaderOptionsChanged, option);
    }

    public openFileUploadConfirmation(files: File[], view: ComposerApiTarget = { view: "room" }): void {
        if (!["room", "thread"].includes(view.view)) {
            throw new Error(`Invalid view '${view.view}'`);
        }
        this.dispatcher.dispatch({
            action: Action.ComposerFileInsert,
            files,
            timelineRenderingType: view.view === "room" ? TimelineRenderingType.Room : TimelineRenderingType.Thread,
        } satisfies ComposerInsertFilesPayload);
    }

    public insertPlaintextIntoComposer(plaintext: string, view: ComposerApiTarget = { view: "room" }): void {
        if (!["room", "thread"].includes(view.view)) {
            throw new Error(`Invalid view '${view.view}'`);
        }
        this.dispatcher.dispatch({
            action: Action.ComposerInsert,
            text: plaintext,
            timelineRenderingType: view.view === "room" ? TimelineRenderingType.Room : TimelineRenderingType.Thread,
            // We only support send.
            composerType: ComposerType.Send,
        } satisfies ComposerInsertPayload);
    }
}
