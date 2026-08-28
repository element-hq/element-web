/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import React, { useEffect, useState } from "react";
import { logger } from "matrix-js-sdk/src/logger";
import type {
    FileViewerRenderFunction,
    MediaHandle,
    RemoteMedia,
    UploadedMedia,
} from "@element-hq/element-web-module-api";

import { ModuleApi } from "./Api.ts";
import { _t } from "../languageHandler";
import { WebBrowserIcon, EditIcon } from "@vector-im/compound-design-tokens/assets/web/icons";

const PDF_MIMETYPE = "application/pdf";

export const PDF_FILE_VIEWER_ID = "io.element.file_viewer.pdf";
export const LINK_FILE_VIEWER_ID = "io.element.file_viewer.link";

const frameStyle: React.CSSProperties = { display: "block", width: "100%", height: "100%", border: "none" };
const messageStyle: React.CSSProperties = { padding: "var(--cpd-space-4x)", textAlign: "center" };

/**
 * Matches PDFs uploaded to matrix. Remote (link bundle) PDFs are left to the link viewer, which can
 * point an iframe straight at the URL without having to download the file first.
 */
function isPdfMedia(media: MediaHandle): media is UploadedMedia {
    return media.type === "uploaded" && media.mimetype === PDF_MIMETYPE;
}

/**
 * Matches anything that is just a URL, i.e. every link that came with a preview bundle.
 */
function isRemoteMedia(media: MediaHandle): media is RemoteMedia {
    return media.type === "remote";
}

function PdfFileViewer({ media }: { media: UploadedMedia }): React.JSX.Element {
    const [objectUrl, setObjectUrl] = useState<string | undefined>(undefined);
    const [failed, setFailed] = useState(false);

    useEffect(() => {
        let unmounted = false;
        let url: string | undefined;

        media
            .blob()
            .then((blob) => {
                // The mimetype in the event content is picked by the sender, so the blob is re-typed
                // before it reaches the iframe: a blob URL is same-origin to us, and this makes sure
                // an HTML payload claiming to be a PDF is rendered as a broken PDF rather than as a
                // document on our own origin.
                const pdf = blob.type === PDF_MIMETYPE ? blob : new Blob([blob], { type: PDF_MIMETYPE });
                url = URL.createObjectURL(pdf);
                if (unmounted) {
                    URL.revokeObjectURL(url);
                } else {
                    setObjectUrl(url);
                }
            })
            .catch((err) => {
                logger.error("PdfFileViewer: could not load the source blob", err);
                setFailed(true);
            });

        return () => {
            unmounted = true;
            if (url !== undefined) URL.revokeObjectURL(url);
        };
    }, [media]);

    if (failed) return <div style={messageStyle}>{_t("common|error")}</div>;
    if (objectUrl === undefined) return <div style={messageStyle}>{_t("common|loading")}</div>;

    return (
        <iframe
            title={media.name}
            src={objectUrl}
            style={frameStyle}
            // A blob URL only resolves for the origin that created it, so allow-same-origin is
            // required to load it at all, and dropping allow-scripts stops the browser's own PDF
            // viewer from running. That combination is safe here because the blob is forced to
            // application/pdf above, so it can never be parsed as a document on our origin.
            // oxlint-disable-next-line react/iframe-missing-sandbox
            sandbox="allow-scripts allow-same-origin"
        />
    );
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
    isPdfMedia(media) ? <PdfFileViewer media={media} /> : <></>;

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
        // TODO: these need i18n keys of their own adding to en_EN.json
        cardHeader: "PDF",
        buttonText: "Open PDF",
        buttonIcon: <EditIcon />
    });

    ModuleApi.instance.fileViewer.registerFileViewer(isRemoteMedia, renderLinkFileViewer, {
        id: LINK_FILE_VIEWER_ID,
        cardHeader: "Link",
        buttonText: "Open link",
        buttonIcon: <WebBrowserIcon />
    });
}
