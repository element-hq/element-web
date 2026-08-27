/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import type { JSX } from "react/jsx-runtime";
import type { MediaHandle } from "./file-viewer";

export interface CustomPreviewTileIcon {
    icon: JSX.Element;
    color: string;
}

export interface CustomPreviewTilePatch {
    icon?: CustomPreviewTileIcon;
    header?: string;
    subtext?: string;
}

export interface CustomPreviewTileOptions {
    id: string;
}

export type CustomPreviewTilePatcher = (media: MediaHandle) => CustomPreviewTilePatch | null;

export interface CustomPreviewTileApi {
    registerCustomPreviewTilePatcher(patcher: CustomPreviewTilePatcher, opts: CustomPreviewTileOptions): void;
}
