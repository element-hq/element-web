/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import AttachmentIcon from "@vector-im/compound-design-tokens/assets/web/icons/attachment";
import {
    ComposorApiFileUploadLocal,
    type ComposorApiFileUploadOption,
    type ComposorApi as ModuleComposorApi,
} from "@element-hq/element-web-module-api";

import { _t } from "../languageHandler";

export class ComposorApi implements ModuleComposorApi {
    public readonly ComposorApiFileUploadLocal: string = ComposorApiFileUploadLocal;
    public readonly fileUploadOptions: Map<string, ComposorApiFileUploadOption> = new Map();

    public constructor() {
        this.fileUploadOptions.set(ComposorApiFileUploadLocal, {
            type: ComposorApiFileUploadLocal,
            icon: AttachmentIcon as any,
            label: _t("common|attachment"),
            onSelected: () => {
                // TODO: Fill in
            },
        });
    }

    public addFileUploadOption(option: ComposorApiFileUploadOption): void {
        if (this.fileUploadOptions.has(option.type)) {
            throw new Error(`Another module has already registered "${option.type}"`);
        }
        this.fileUploadOptions.set(option.type, option);
    }
    public disableFileUploadOption(type: string): boolean {
        return this.fileUploadOptions.delete(type);
    }
}
