/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import type {
    CustomPreviewTileIcon,
    CustomPreviewTileOptions,
    CustomPreviewTilePatcher,
    CustomPreviewTileApi as ICustomPreviewTileApi,
    MediaHandle,
} from "@element-hq/element-web-module-api";
import type { MediaPreviewIcon } from "@element-hq/web-shared-components";
import { logger as rootLogger } from "matrix-js-sdk/src/logger";

const logger = rootLogger.getChild("CustomPreviewTileApi");

export interface RegisteredCustomPreviewTilePatcher {
    patcher: CustomPreviewTilePatcher;
    options: CustomPreviewTileOptions;
}

export interface CustomPreviewTilePatchBatch {
    icons: CustomPreviewTileIcon[];
    headers: string[];
    subtexts: string[];
}

export class CustomPreviewTileApi implements ICustomPreviewTileApi {
    private readonly patchers: Map<string, RegisteredCustomPreviewTilePatcher> = new Map();
    private sortedPatchers: RegisteredCustomPreviewTilePatcher[] = [];

    public registerCustomPreviewTilePatcher(
        patcher: CustomPreviewTilePatcher,
        options: CustomPreviewTileOptions,
    ): void {
        if (this.patchers.has(options.id))
            throw new Error(`A custom preview tile patcher with ID ${options.id} has already been registered`);

        const regPatcher: RegisteredCustomPreviewTilePatcher = {
            patcher,
            options,
        };
        this.patchers.set(options.id, regPatcher);
        this.sortedPatchers.push(regPatcher);
        this.sortedPatchers.sort((a, b) => a.options.id.localeCompare(b.options.id));
    }

    public applyPatchers(media: MediaHandle): CustomPreviewTilePatchBatch {
        const batch = CustomPreviewTileApi.emptyBatch;

        for (const { patcher, options } of this.sortedPatchers) {
            let patch;
            try {
                patch = patcher(media);
            } catch (e) {
                logger.error(`Custom preview tile patcher ${options.id} threw, skipping it`, e);
                continue;
            }
            if (!patch) continue;

            if (patch.icon) batch.icons.push(patch.icon);
            if (patch.header) batch.headers.push(patch.header);
            if (patch.subtext) batch.subtexts.push(patch.subtext);
        }

        return batch;
    }

    public static previewPatchToVmProps(
        patches: CustomPreviewTilePatchBatch,
        { header, body, icon, onClick, color }: { header: string; body: string } & MediaPreviewIcon,
    ): { header: string; body: string } & MediaPreviewIcon {
        return {
            header: patches.headers.length ? patches.headers.join(" • ") : header,
            body: patches.subtexts.length ? patches.subtexts.join(" • ") : body,
            ...(patches.icons[patches.icons.length - 1] ?? { icon, onClick, color }),
        };
    }

    public static get emptyBatch(): CustomPreviewTilePatchBatch {
        return {
            icons: [],
            headers: [],
            subtexts: [],
        };
    }
}
