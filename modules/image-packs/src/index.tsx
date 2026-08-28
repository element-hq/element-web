/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";

import type { Api, Module, ModuleFactory } from "@element-hq/element-web-module-api";

import { ImagePacksSettings } from "./ImagePacksSettings.tsx";
import { ensureImagePacksStyles } from "./style.ts";
import { useImagePacks, type UseImagePacksOptions } from "./useImagePacks.ts";
/**
 * Shape the host application must expose on `api.customisations` for the
 * module to mount its settings UI. The host constructs a `PackWriters`
 * bridge around its live `MatrixClient` and passes it via `UseImagePacksOptions`.
 */
export interface ImagePacksMountCustomisations {
    /** Called once at module load so the host can render the settings UI. */
    registerImagePacksMount?: (mount: ImagePacksRenderer) => void;
}

export type ImagePacksRenderer = (opts: UseImagePacksOptions & { roomId?: string }) => React.ReactNode;

class ImagePacksModule implements Module {
    public static readonly moduleApiVersion = "^1.0.0";

    public constructor(private readonly api: Api) {}

    public async load(): Promise<void> {
        ensureImagePacksStyles();

        const customisations = this.api.customisations as unknown as ImagePacksMountCustomisations;

        if (typeof customisations.registerImagePacksMount === "function") {
            customisations.registerImagePacksMount((opts) => {
                const hook = useImagePacks(opts);
                return <ImagePacksSettings api={hook} roomId={opts.roomId} />;
            });
        }
    }
}

export default ImagePacksModule satisfies ModuleFactory;

// Re-exports for hosts that want to use individual pieces.
export { ImagePacksSettings } from "./ImagePacksSettings.tsx";
export { PackListPanel } from "./PackListPanel.tsx";
export { DiscoveryPanel } from "./DiscoveryPanel.tsx";
export { useImagePacks } from "./useImagePacks.ts";
export { parsePackJson, exportPackJson, PackImportError } from "./import-export.ts";
export { resolveEnabledPacks } from "./resolver.ts";
export {
    resolveDiscoverySource,
    fetchDiscoveryPack,
    mergeDiscoveryPackMetadata,
    addDiscoverySource,
    removeDiscoverySource,
    readDiscoverySources,
    DiscoverySourceError,
} from "./discovery.ts";
export type {
    UseImagePacksOptions,
    UseImagePacksResult,
    ImagePackView,
    ImagePackMediaUrl,
    ImagePackUpload,
} from "./useImagePacks.ts";
export type { AccountDataContentUpdate, AccountDataTransaction, AccountDataTransactionCallback } from "./discovery.ts";
export type {
    EmoteDefinition,
    ImagePackDefinition,
    DiscoverySource,
    DiscoveryIndex,
    DiscoveryIndexEntry,
    PackImportPayload,
    ImagePackScope,
    ImagePackKind,
} from "./types.ts";
export {
    IMAGE_PACK_DISCOVERY_SOURCES_EVENT_TYPE,
    IMAGE_PACK_DISCOVERY_SOURCES_UNSTABLE_EVENT_TYPE,
    ROOM_IMAGE_PACK_ORDER_EVENT_TYPE,
    LEGACY_ROOM_IMAGE_PACK_ORDER_STATE_KEY,
} from "./types.ts";
export type { PackWriters, PackStoreClient, CreateRoomPackInput, RoomPackDraft } from "./store.ts";
export type { ResolverClient, ResolverRoom, ResolvedPackSummary } from "./resolver.ts";
