/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import React from "react";
import type { FileViewerRenderFunction, MediaHandle, RemoteMedia } from "@element-hq/element-web-module-api";

import { ModuleApi } from "./Api.ts";
import { _t } from "../languageHandler";
import { WebBrowserIcon, EditIcon } from "@vector-im/compound-design-tokens/assets/web/icons";
import { PdfViewer } from "../components/views/right_panel/PdfViewer";

const PDF_MIMETYPE = "application/pdf";

export const PDF_FILE_VIEWER_ID = "io.element.file_viewer.pdf";
export const LINK_FILE_VIEWER_ID = "io.element.file_viewer.link";

const frameStyle: React.CSSProperties = { display: "block", width: "100%", height: "100%", border: "none" };

/**
 * Matches PDFs uploaded to matrix. Remote (link bundle) PDFs are left to the link viewer, which can
 * point an iframe straight at the URL without having to download the file first.
 */
export function isPdfMedia(media: MediaHandle): boolean {
    return media.type === "uploaded" && media.mimetype?.split(";")[0].trim().toLowerCase() === PDF_MIMETYPE;
}

/**
 * Matches anything that is just a URL, i.e. every link that came with a preview bundle.
 */
function isRemoteMedia(media: MediaHandle): media is RemoteMedia {
    return media.type === "remote";
}

function LinkFileViewer({ media }: { media: RemoteMedia }): React.JSX.Element {
    const url = media.bundle.matched_url;

    return (
        <iframe
            title={media.bundle["og:title"] ?? url}
            src={url}
            style={frameStyle}
            // allow-same-origin keeps the remote site on its own origin rather than ours, so this
            // is ordinary cross-origin framing; without it, and without scripts, most sites break.
            // oxlint-disable-next-line react/iframe-missing-sandbox
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
            referrerPolicy="no-referrer"
        />
    );
}

const renderPdfFileViewer: FileViewerRenderFunction = ({ media }) =>
    isPdfMedia(media) && media.type === "uploaded" ? <PdfViewer media={media} /> : <></>;

const renderLinkFileViewer: FileViewerRenderFunction = ({ media }) =>
    isRemoteMedia(media) ? <LinkFileViewer media={media} /> : <></>;

/**
 * Register the file viewers that ship with element-web itself. Must be called exactly once during
 * startup, before the right panel restores its state: registering the same viewer ID twice throws,
 * and a card stored for an unregistered viewer ID is dropped on load.
 */
export function registerDefaultFileViewers(): void {
    ModuleApi.instance.fileViewer.registerFileViewer(isPdfMedia, renderPdfFileViewer, {
        id: PDF_FILE_VIEWER_ID,
        cardHeader: _t("pdf_viewer|title"),
        buttonText: _t("pdf_viewer|open"),
        buttonIcon: <EditIcon />,
    });

    ModuleApi.instance.fileViewer.registerFileViewer(isRemoteMedia, renderLinkFileViewer, {
        id: LINK_FILE_VIEWER_ID,
        cardHeader: "Link",
        buttonText: "Open link",
        buttonIcon: <WebBrowserIcon />,
    });
}
