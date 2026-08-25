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
import { isPdfEvent, openPdfViewer } from "../../utils/pdfViewer";
import RightPanelStore from "../../stores/right-panel/RightPanelStore";
import { RightPanelPhases } from "../../stores/right-panel/RightPanelStorePhases";
import { ModuleApi } from "../../modules/Api";
import { uploadedMediaForEvent } from "../../modules/FileViewerApi";

export class MBodyTileViewModel extends MediaPreviewGroupViewModel {
    private readonly mxEvent: MatrixEvent;
    private readonly mediaEventHelper: MediaEventHelper;

    public constructor(mxEvent: MatrixEvent, mediaEventHelper: MediaEventHelper, pdfViewerEnabled = false) {
        super(MBodyTileViewModel.buildSnapshot(mxEvent, mediaEventHelper, pdfViewerEnabled));
        this.mxEvent = mxEvent;
        this.mediaEventHelper = mediaEventHelper;
    }

    /**
     * Re-derive the tile for a new value of the PDF viewer lab. The setting can be toggled while the
     * tile is already on screen, so the entry has to be rebuilt rather than only built on construction.
     *
     * @param pdfViewerEnabled Whether the PDF viewer lab is currently enabled.
     */
    public setPdfViewerEnabled(pdfViewerEnabled: boolean): void {
        this.setProps(MBodyTileViewModel.buildSnapshot(this.mxEvent, this.mediaEventHelper, pdfViewerEnabled));
    }

    private static buildSnapshot(
        mxEvent: MatrixEvent,
        mediaEventHelper: MediaEventHelper,
        pdfViewerEnabled: boolean,
    ): MediaPreviewGroupSnapshot {
        const downloader = new FileDownloader();
        const content = mxEvent.getContent<MediaEventContent>();
        const size = content.info?.size;

        const mediaHandle = uploadedMediaForEvent(mxEvent, mediaEventHelper);
        const fileViewers = mediaHandle ? ModuleApi.instance.fileViewer.getViewersFor(mediaHandle) : [];
        const additionalButtons: MediaPreviewEntryButton[] = fileViewers.map((viewer) => ({
            label: viewer.options.buttonText,
            icon: <ExpandIcon />,
            onClick: () =>
                RightPanelStore.instance.setGlobalCard({
                    phase: RightPanelPhases.FileViewer,
                    state: {
                        fileViewer: viewer,
                        fileViewerMedia: mediaHandle,
                        fileViewerSourceEvent: mxEvent,
                    },
                }),
        }));

        // includes the download buttonn if mediaEventHelper is not undefined
        const buttons: MediaPreviewEntryButton[] | undefined = mediaEventHelper && [
            ...additionalButtons,
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
            // Behind the same lab as the legacy file body's viewer, and only for PDFs.
            ...(pdfViewerEnabled && isPdfEvent(mxEvent)
                ? [
                      {
                          label: _t("pdf_viewer|open"),
                          icon: <ExpandIcon />,
                          onClick: () => openPdfViewer(mxEvent),
                      },
                  ]
                : []),
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
