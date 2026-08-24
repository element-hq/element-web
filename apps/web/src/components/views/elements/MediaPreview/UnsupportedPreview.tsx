/*
Copyright 2026 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX } from "react";
import { type MatrixEvent } from "matrix-js-sdk/src/matrix";
import { type MediaEventContent } from "matrix-js-sdk/src/types";

import { _t } from "../../../../languageHandler";
import { mediaFromContent } from "../../../../customisations/Media";
import { presentableTextForFile } from "../../../../utils/FileUtils";
import { type RoomPermalinkCreator } from "../../../../utils/permalinks/Permalinks";
import MediaPreviewShell from "./MediaPreviewShell";
import { PreviewError } from "./PreviewError";

interface Props {
    mxEvent?: MatrixEvent;
    permalinkCreator?: RoomPermalinkCreator;
    onFinished: () => void;
}

/**
 * The fallback previewer: full chrome, an explanation, and the download button.
 *
 * Callers gate on {@link canPreviewFile} before opening the dialog, so in practice this is only
 * reached if a format slips through — but it is a far better dead end than a blank lightbox.
 */
export default function UnsupportedPreview({ mxEvent, permalinkCreator, onFinished }: Props): JSX.Element {
    const content = mxEvent?.getContent<MediaEventContent>();

    return (
        <MediaPreviewShell
            label={_t("file_preview|title")}
            mxEvent={mxEvent}
            permalinkCreator={permalinkCreator}
            title={content ? presentableTextForFile(content, _t("common|attachment"), true) : undefined}
            downloadUrl={content ? (mediaFromContent(content).srcHttp ?? "") : ""}
            downloadName={content?.filename ?? content?.body}
            onFinished={onFinished}
        >
            <PreviewError />
        </MediaPreviewShell>
    );
}
