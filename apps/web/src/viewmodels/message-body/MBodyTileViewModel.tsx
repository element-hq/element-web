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

export class MBodyTileViewModel extends MediaPreviewGroupViewModel {
    public constructor(mxEvent: MatrixEvent, mediaEventHelper: MediaEventHelper) {
        const downloader = new FileDownloader();
        const content = mxEvent.getContent<MediaEventContent>();
        const size = content.info?.size;
        // includes the download buttonn if mediaEventHelper is not undefined
        const buttons: MediaPreviewEntryButton[] | undefined = mediaEventHelper && [
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
                    header: mediaEventHelper.fileName,
                    body: size === undefined ? _t("timeline|m.file|size_unknown") : fileSize(size),
                    buttons,
                    ...attachmentIcon(content.info?.mimetype),
                },
            ],
        };

        super(snapshot);
    }
}
