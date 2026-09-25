/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import React from "react";
import {
    _t,
    attachmentIcon,
    type MediaPreviewEntryButton,
    type MediaPreviewGroupSnapshot,
} from "@element-hq/web-shared-components";
import { MediaPreviewGroupViewModel } from "./MediaPreviewGroupViewModel";
import { type MatrixEvent } from "matrix-js-sdk/src/matrix";
import { type MediaEventHelper } from "../../utils/MediaEventHelper";
import { DownloadIcon, ExpandIcon } from "@vector-im/compound-design-tokens/assets/web/icons";
import { type MediaEventContent } from "matrix-js-sdk/src/types";
import { FileDownloader } from "../../utils/FileDownloader";
import { fileSize } from "../../utils/FileUtils";
import { attachmentViewerForEvent, type AttachmentViewerLabs } from "../../utils/attachmentViewer";

/** No viewer labs on, for callers that do not read the settings. */
const NO_VIEWER_LABS: AttachmentViewerLabs = { pdfViewerEnabled: false, markdownViewerEnabled: false };

export class MBodyTileViewModel extends MediaPreviewGroupViewModel {
    private readonly mxEvent: MatrixEvent;
    private readonly mediaEventHelper: MediaEventHelper;

    public constructor(mxEvent: MatrixEvent, mediaEventHelper: MediaEventHelper, labs = NO_VIEWER_LABS) {
        super(MBodyTileViewModel.buildSnapshot(mxEvent, mediaEventHelper, labs));
        this.mxEvent = mxEvent;
        this.mediaEventHelper = mediaEventHelper;
    }

    /**
     * Re-derive the tile for new values of the viewer labs. A setting can be toggled while the tile is
     * already on screen, so the entry has to be rebuilt rather than only built on construction.
     *
     * @param labs Which viewer labs are currently enabled.
     */
    public setViewerLabs(labs: AttachmentViewerLabs): void {
        this.setProps(MBodyTileViewModel.buildSnapshot(this.mxEvent, this.mediaEventHelper, labs));
    }

    private static buildSnapshot(
        mxEvent: MatrixEvent,
        mediaEventHelper: MediaEventHelper,
        labs: AttachmentViewerLabs,
    ): MediaPreviewGroupSnapshot {
        const downloader = new FileDownloader();
        const content = mxEvent.getContent<MediaEventContent>();
        const size = content.info?.size;
        // Behind the same labs as the legacy file body's viewers.
        const viewer = attachmentViewerForEvent(mxEvent, labs);
        // includes the download buttonn if mediaEventHelper is not undefined
        const buttons: MediaPreviewEntryButton[] | undefined = mediaEventHelper && [
            ...(viewer ? [{ label: viewer.openLabel, icon: <ExpandIcon />, onClick: viewer.open }] : []),
            {
                label: _t("action|download"),
                icon: <DownloadIcon />,
                onClick: async () => {
                    await downloader.download({
                        blob: await mediaEventHelper.sourceBlob.value, // decrypts transparently if E2EE
                        name: mediaEventHelper.fileName || _t("common|attachment"),
                    });
                },
            },
        ];

        return {
            entries: [
                {
                    id: mxEvent.getId()!,
                    type: "text",
                    header: mediaEventHelper.fileName,
                    body: size === undefined ? _t("timeline|m.file|size_unknown") : fileSize(size),
                    buttons,
                    ...attachmentIcon(content.info?.mimetype),
                },
            ],
        } satisfies MediaPreviewGroupSnapshot;
    }
}
