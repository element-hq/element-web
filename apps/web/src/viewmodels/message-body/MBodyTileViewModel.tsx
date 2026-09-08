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
import { DownloadIcon } from "@vector-im/compound-design-tokens/assets/web/icons";
import { type MediaEventContent } from "matrix-js-sdk/src/types";
import { FileDownloader } from "../../utils/FileDownloader";
import { fileSize } from "../../utils/FileUtils";
import { ModuleApi } from "../../modules/Api";
import { uploadedMediaForEvent } from "../../modules/FileViewerApi";
import { fileViewerOpenButton } from "../../components/views/right_panel/FileViewerCard";
import { CustomPreviewTileApi } from "../../modules/CustomPreviewTileApi";

export class MBodyTileViewModel extends MediaPreviewGroupViewModel {
    public constructor(mxEvent: MatrixEvent, mediaEventHelper: MediaEventHelper) {
        const downloader = new FileDownloader();
        const content = mxEvent.getContent<MediaEventContent>();
        const size = content.info?.size;

        const mediaHandle = uploadedMediaForEvent(mxEvent, mediaEventHelper);
        const fileViewers = mediaHandle ? ModuleApi.instance.fileViewer.getViewersFor(mediaHandle) : [];
        const fileViewerButtons: MediaPreviewEntryButton[] = mediaHandle
            ? fileViewers.map((viewer) => fileViewerOpenButton({ viewer, media: mediaHandle, mxEvent }))
            : [];
        const patches = mediaHandle
            ? ModuleApi.instance.customPreviewTile.applyPatchers(mediaHandle)
            : CustomPreviewTileApi.emptyBatch;

        // includes the download buttonn if mediaEventHelper is not undefined
        const buttons: MediaPreviewEntryButton[] | undefined = mediaEventHelper && [
            ...fileViewerButtons,
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

        const snapshot: MediaPreviewGroupSnapshot = {
            entries: [
                {
                    id: mxEvent.getId()!,
                    type: "text",
                    buttons,
                    ...CustomPreviewTileApi.previewPatchToVmProps(patches, {
                        header: mediaEventHelper.fileName,
                        body: size === undefined ? _t("timeline|m.file|size_unknown") : fileSize(size),
                        ...attachmentIcon(content.info?.mimetype),
                    }),
                },
            ],
        };

        super(snapshot);
    }
}
