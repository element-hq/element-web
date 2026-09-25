/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import React, { type JSX, useEffect, useState } from "react";
import { logger as rootLogger } from "matrix-js-sdk/src/logger";
import {
    type FileViewerApi,
    type FileViewerProps,
    type MediaHandle,
    type RemoteMedia,
} from "@element-hq/element-web-module-api";
import DocumentIcon from "@vector-im/compound-design-tokens/assets/web/icons/document";
import WebBrowserIcon from "@vector-im/compound-design-tokens/assets/web/icons/web-browser";

import Spinner from "../components/views/elements/Spinner";

const logger = rootLogger.getChild("DemoFileViewers");

const PDF_MIMETYPE = "application/pdf";

/** Hosts the site viewer claims. Bare `github.com` plus its subdomains, so `gist.github.com` counts too. */
const GITHUB_HOST = "github.com";

/**
 * The link a remote preview points at, if it is one a viewer can frame. Previews arrive from the
 * homeserver, so the link is not guaranteed to parse, and only `http(s)` is safe to put in an iframe.
 */
function previewUrl(media: RemoteMedia): URL | undefined {
    let url: URL;
    try {
        url = new URL(media.preview.link);
    } catch {
        return undefined;
    }

    return url.protocol === "https:" || url.protocol === "http:" ? url : undefined;
}

/** Best name to put in the card header for a remote preview. */
function previewName(media: RemoteMedia): string {
    const { title, siteName, link } = media.preview;
    return title || siteName || link;
}

function isPdf(media: MediaHandle): boolean {
    if (media.type === "uploaded") {
        // Parameters after the type itself (`application/pdf; version=1.7`) say nothing about whether
        // we can render it, so they are stripped before comparing.
        const mimetype = media.mimetype?.split(";")[0].trim().toLowerCase();
        if (mimetype) return mimetype === PDF_MIMETYPE;

        // Senders do not always set a mimetype; fall back to what the file calls itself.
        return media.name.toLowerCase().endsWith(".pdf");
    }

    return previewUrl(media)?.pathname.toLowerCase().endsWith(".pdf") ?? false;
}

function isGitHubLink(media: MediaHandle): boolean {
    if (media.type !== "remote") return false;

    const host = previewUrl(media)?.hostname.toLowerCase();
    return host === GITHUB_HOST || (host?.endsWith(`.${GITHUB_HOST}`) ?? false);
}

/**
 * The frame both viewers render into.
 *
 * The card is a flex column of known height, so the frame is sized to fill what is left rather than
 * falling back to the default iframe height.
 */
function Frame({ src, title, sandbox }: { src: string; title: string; sandbox?: string }): JSX.Element {
    return (
        <div style={{ display: "flex", height: "100%", minHeight: 0 }}>
            <iframe
                src={src}
                title={title}
                sandbox={sandbox}
                referrerPolicy="no-referrer"
                style={{ flex: 1, minHeight: 0, width: "100%", border: "none" }}
            />
        </div>
    );
}

/**
 * Dummy PDF viewer: hands the file to the browser's own PDF plugin in an iframe.
 *
 * An attachment has to be fetched (and decrypted, in an encrypted room) before it can be framed, so
 * it is handed to the frame as an object URL. A remote PDF is already a URL the browser can fetch.
 */
function DemoPdfViewer({ media }: FileViewerProps): JSX.Element {
    const [src, setSrc] = useState<string | undefined>(() =>
        media.type === "remote" ? previewUrl(media)?.toString() : undefined,
    );
    const [failed, setFailed] = useState(false);

    useEffect(() => {
        if (media.type !== "uploaded") return;

        let objectUrl: string | undefined;
        let disposed = false;

        void media
            .blob()
            .then((blob) => {
                if (disposed) return;

                objectUrl = URL.createObjectURL(blob);
                setSrc(objectUrl);
            })
            .catch((error: unknown) => {
                if (disposed) return;

                logger.error("Unable to load PDF attachment", error);
                setFailed(true);
            });

        return () => {
            disposed = true;
            // The frame is going away with the card, so the blob must not be left pinned in memory.
            if (objectUrl) URL.revokeObjectURL(objectUrl);
        };
    }, [media]);

    if (failed) return <div>Unable to load this PDF.</div>;
    if (!src) return <Spinner />;

    return <Frame src={src} title={pdfHeader(media)} />;
}

/**
 * Dummy site viewer: puts the linked page itself in an iframe.
 *
 * The page is a third party's, so it is sandboxed. `allow-same-origin` restores the framed page's own
 * origin — not ours — which is what lets it load its own assets; it never gets access to Element's.
 */
function DemoSiteViewer({ media }: FileViewerProps): JSX.Element {
    if (media.type !== "remote") return <div>This viewer only opens links.</div>;

    const url = previewUrl(media);
    if (!url) return <div>Unable to open this link.</div>;

    return (
        <Frame
            src={url.toString()}
            title={previewName(media)}
            sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
        />
    );
}

function pdfHeader(media: MediaHandle): string {
    return media.type === "uploaded" ? media.name : previewName(media);
}

/**
 * Register the demo file viewers against the module API.
 *
 * These exercise the file viewer API from inside the app rather than from a real module: everything
 * here goes through the same public surface a module would use.
 */
export function registerDemoFileViewers(fileViewer: FileViewerApi): void {
    fileViewer.registerFileViewer(isPdf, DemoPdfViewer, {
        id: "io.element.demo.pdf-viewer",
        cardHeader: pdfHeader,
        buttonText: "Open PDF (demo)",
        buttonIcon: <DocumentIcon />,
    });

    fileViewer.registerFileViewer(isGitHubLink, DemoSiteViewer, {
        id: "io.element.demo.site-viewer",
        cardHeader: (media) => (media.type === "remote" ? previewName(media) : "Site"),
        buttonText: "Open site (demo)",
        buttonIcon: <WebBrowserIcon />,
    });
}
