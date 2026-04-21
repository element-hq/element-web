/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import AttachmentIcon from "@vector-im/compound-design-tokens/assets/web/icons/attachment";
import {
    ComposerApiFileUploadLocal,
    type ComposerExtraContentPreview,
    type ComposerApiFileUploadOption,
    type ComposerApi as ModuleComposerApi,
} from "@element-hq/element-web-module-api";

import { _t } from "../languageHandler";
import defaultDispatcher from "../dispatcher/dispatcher";
import { Action } from "../dispatcher/actions";
import type { ComposerInsertPayload, IComposerInsertEventContent } from "../dispatcher/payloads/ComposerInsertPayload";
import { TimelineRenderingType } from "../contexts/RoomContext";

export class ComposerApi implements ModuleComposerApi {
    public readonly ComposerApiFileUploadLocal = ComposerApiFileUploadLocal;
    public readonly fileUploadOptions: Map<string, ComposerApiFileUploadOption> = new Map();

    public constructor() {
        this.fileUploadOptions.set(ComposerApiFileUploadLocal, {
            type: ComposerApiFileUploadLocal,
            icon: AttachmentIcon as any,
            label: _t("common|attachment"),
            onSelected: () => {
                // TODO: Fill in
            },
        });
    }

    public addFileUploadOption(option: ComposerApiFileUploadOption): void {
        if (this.fileUploadOptions.has(option.type)) {
            throw new Error(`Another module has already registered "${option.type}"`);
        }
        this.fileUploadOptions.set(option.type, option);
    }

    public disableFileUploadOption(type: string): boolean {
        return this.fileUploadOptions.delete(type);
    }

    public insertTextIntoComposer(text: string): void {
        defaultDispatcher.dispatch({
            action: Action.ComposerInsert,
            text,
            timelineRenderingType: TimelineRenderingType.Room,
        } satisfies ComposerInsertPayload);
    }

    public insertEventContentIntoComposer<T extends object>(
        key: string,
        eventContent: T,
        previewRenderable: ComposerExtraContentPreview<T>,
    ): void {
        defaultDispatcher.dispatch({
            action: Action.ComposerInsert,
            key,
            eventContent,
            previewRenderable,
            timelineRenderingType: TimelineRenderingType.Room,
        } satisfies IComposerInsertEventContent<T>);
    }
}
