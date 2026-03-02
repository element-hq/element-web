/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { createRef, type MouseEvent, type RefObject } from "react";
import { logger } from "matrix-js-sdk/src/logger";
import { MsgType, type MatrixEvent } from "matrix-js-sdk/src/matrix";
import { type MediaEventContent } from "matrix-js-sdk/src/types";
import {
    BaseViewModel,
    MFileBodyViewRendering,
    MFileBodyViewInfoIcon,
    type MFileBodyViewSnapshot,
    type MFileBodyViewModel as MFileBodyViewModelInterface,
} from "@element-hq/web-shared-components";

import Modal from "../../Modal";
import { _t } from "../../languageHandler";
import { mediaFromContent } from "../../customisations/Media";
import { downloadLabelForFile, presentableTextForFile } from "../../utils/FileUtils";
import { FileDownloader } from "../../utils/FileDownloader";
import { type MediaEventHelper } from "../../utils/MediaEventHelper";
import { TimelineRenderingType } from "../../contexts/RoomContext";
import ErrorDialog from "../../components/views/dialogs/ErrorDialog";

export interface MFileBodyViewModelProps {
    mxEvent: MatrixEvent;
    mediaEventHelper?: MediaEventHelper;
    forExport?: boolean;
    showFileInfo?: boolean;
    timelineRenderingType: TimelineRenderingType;
}

// cached copy of the download.svg asset for the sandboxed iframe later on
export let DOWNLOAD_ICON_URL: string;

async function cacheDownloadIcon(): Promise<void> {
    if (DOWNLOAD_ICON_URL) return;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const svg = await fetch(require("@vector-im/compound-design-tokens/icons/download.svg").default).then((r) =>
        r.text(),
    );
    DOWNLOAD_ICON_URL = "data:image/svg+xml;base64," + window.btoa(svg);
}

// Cache the asset immediately
// noinspection JSIgnoredPromiseFromCall
cacheDownloadIcon();

// User supplied content can contain scripts, we have to be careful that
// we don't accidentally run those script within the same origin as the
// client. Otherwise those scripts written by remote users can read
// the access token and end-to-end keys that are in local storage.
//
// For attachments downloaded directly from the homeserver we can use
// Content-Security-Policy headers to disable script execution.
//
// But attachments with end-to-end encryption are more difficult to handle.
// We need to decrypt the attachment on the client and then display it.
// To display the attachment we need to turn the decrypted bytes into a URL.
//
// There are two ways to turn bytes into URLs, data URL and blob URLs.
// Data URLs aren't suitable for downloading a file because Chrome has a
// 2MB limit on the size of URLs that can be viewed in the browser or
// downloaded. This limit does not seem to apply when the url is used as
// the source attribute of an image tag.
//
// Blob URLs are generated using window.URL.createObjectURL and unfortunately
// for our purposes they inherit the origin of the page that created them.
// This means that any scripts that run when the URL is viewed will be able
// to access local storage.
//
// The easiest solution is to host the code that generates the blob URL on
// a different domain to the client.
// Another possibility is to generate the blob URL within a sandboxed iframe.
// The downside of using a second domain is that it complicates hosting,
// the downside of using a sandboxed iframe is that the browers are overly
// restrictive in what you are allowed to do with the generated URL.

/**
 * Get the current CSS style for a DOMElement.
 * @param {HTMLElement} element The element to get the current style of.
 * @return {string} The CSS style encoded as a string.
 */
function computedStyle(element: HTMLElement | null): string {
    if (!element) {
        return "";
    }
    const style = window.getComputedStyle(element, null);
    let cssText = style.cssText;
    // noinspection EqualityComparisonWithCoercionJS
    if (cssText == "") {
        // Firefox doesn't implement ".cssText" for computed styles.
        // https://bugzilla.mozilla.org/show_bug.cgi?id=137687
        for (const rule of style) {
            cssText += rule + ":";
            cssText += style.getPropertyValue(rule) + ";";
        }
    }
    return cssText;
}

export class MFileBodyViewModel
    extends BaseViewModel<MFileBodyViewSnapshot, MFileBodyViewModelProps>
    implements MFileBodyViewModelInterface
{
    public readonly refIFrame: RefObject<HTMLIFrameElement>;
    public readonly refLink: RefObject<HTMLAnchorElement>;
    private decryptedBlob?: Blob;
    private userDidClick = false;
    private readonly fileDownloader: FileDownloader;

    public constructor(props: MFileBodyViewModelProps) {
        super(props, MFileBodyViewModel.computeSnapshot(props));
        this.refIFrame = createRef<HTMLIFrameElement>() as RefObject<HTMLIFrameElement>;
        this.refLink = createRef<HTMLAnchorElement>() as RefObject<HTMLAnchorElement>;
        this.fileDownloader = new FileDownloader(() => this.refIFrame.current);
    }

    private static getInfoIcon(content: MediaEventContent): MFileBodyViewInfoIcon {
        if (content.msgtype === MsgType.Audio) {
            return MFileBodyViewInfoIcon.AUDIO;
        } else if (content.msgtype === MsgType.Video) {
            return MFileBodyViewInfoIcon.VIDEO;
        }
        return MFileBodyViewInfoIcon.ATTACHMENT;
    }

    private static computeSnapshot(props: MFileBodyViewModelProps, decryptedBlob?: Blob): MFileBodyViewSnapshot {
        const content = props.mxEvent.getContent<MediaEventContent>();
        const media = mediaFromContent(content);

        //Whether or not to show the default placeholder for the file. Defaults to true.
        const showFileInfo = props.showFileInfo ?? true;

        let showDownloadLink =
            !showFileInfo ||
            (props.timelineRenderingType !== TimelineRenderingType.Room &&
                props.timelineRenderingType !== TimelineRenderingType.Search &&
                props.timelineRenderingType !== TimelineRenderingType.Pinned);
        if (showFileInfo) {
            showDownloadLink = false;
        }
        if (props.timelineRenderingType === TimelineRenderingType.Thread) {
            showDownloadLink = false;
        }

        const label = presentableTextForFile(content, _t("common|attachment"), true, true);
        const tooltip = showFileInfo ? presentableTextForFile(content, _t("common|attachment"), true) : undefined;

        if (props.forExport) {
            return {
                rendering: MFileBodyViewRendering.EXPORT,
                label,
                tooltip,
                icon: showFileInfo ? MFileBodyViewModel.getInfoIcon(content) : undefined,
                href: content.file?.url || content.url,
                className: "mx_MFileBody",
            };
        }

        if (media.isEncrypted) {
            return {
                rendering: showDownloadLink
                    ? decryptedBlob
                        ? MFileBodyViewRendering.DOWNLOAD_ENCRYPTED_IFRAME
                        : MFileBodyViewRendering.DOWNLOAD_ENCRYPTED_PENDING
                    : MFileBodyViewRendering.INFO,
                label,
                tooltip,
                icon: showFileInfo ? MFileBodyViewModel.getInfoIcon(content) : undefined,
                className: "mx_MFileBody",
            };
        }

        if (media.srcHttp) {
            return {
                rendering: showDownloadLink ? MFileBodyViewRendering.DOWNLOAD_UNENCRYPTED : MFileBodyViewRendering.INFO,
                label,
                tooltip,
                icon: showFileInfo ? MFileBodyViewModel.getInfoIcon(content) : undefined,
                href: media.srcHttp,
                className: "mx_MFileBody",
            };
        }

        return {
            rendering: MFileBodyViewRendering.INVALID,
            label,
            tooltip,
            icon: showFileInfo ? MFileBodyViewModel.getInfoIcon(content) : undefined,
            className: "mx_MFileBody",
        };
    }

    private get content(): MediaEventContent {
        return this.props.mxEvent.getContent<MediaEventContent>();
    }

    private get fileName(): string {
        return this.props.mediaEventHelper?.fileName || _t("common|attachment");
    }

    private get linkText(): string {
        return downloadLabelForFile(this.content, true);
    }

    private downloadFile(fileName: string, text: string): void {
        if (!this.decryptedBlob) return;

        this.fileDownloader.download({
            blob: this.decryptedBlob,
            name: fileName,
            autoDownload: this.userDidClick,
            opts: {
                imgSrc: DOWNLOAD_ICON_URL,
                imgStyle: null,
                style: computedStyle(this.refLink.current),
                textContent: text,
            },
        });
    }

    private decryptFile = async (): Promise<void> => {
        if (this.decryptedBlob || !this.props.mediaEventHelper) {
            return;
        }
        try {
            this.userDidClick = true;
            this.decryptedBlob = await this.props.mediaEventHelper.sourceBlob.value;
            this.snapshot.set(MFileBodyViewModel.computeSnapshot(this.props, this.decryptedBlob));
        } catch (err) {
            logger.warn("Unable to decrypt attachment: ", err);
            Modal.createDialog(ErrorDialog, {
                title: _t("common|error"),
                description: _t("timeline|m.file|error_decrypting"),
            });
        }
    };

    public onInfoClick = async (): Promise<void> => {
        if (this.props.forExport || !(this.props.showFileInfo ?? true) || !this.props.mediaEventHelper) {
            return;
        }

        if (this.props.mediaEventHelper.media.isEncrypted) {
            await this.decryptFile();
            this.downloadFile(this.fileName, this.linkText);
            return;
        }

        this.fileDownloader.download({
            blob: await this.props.mediaEventHelper.sourceBlob.value,
            name: this.fileName,
        });
    };

    public onDownloadClick = (): Promise<void> => this.decryptFile();

    public onDownloadLinkClick = (event: MouseEvent<HTMLAnchorElement>): void => {
        if (!this.props.mediaEventHelper) return;

        const fileType = this.content.info?.mimetype ?? "application/octet-stream";
        logger.log(`Downloading ${fileType} as blob (unencrypted)`);

        event.preventDefault();
        event.stopPropagation();

        this.props.mediaEventHelper.sourceBlob.value.then((blob) => {
            const blobUrl = URL.createObjectURL(blob);
            const tempAnchor = document.createElement("a");
            tempAnchor.download = this.fileName;
            tempAnchor.href = blobUrl;
            document.body.appendChild(tempAnchor);
            tempAnchor.click();
            tempAnchor.remove();
        });
    };

    public onDownloadIframeLoad = (): void => {
        this.downloadFile(this.fileName, this.linkText);
    };

    public setProps(newProps: Partial<MFileBodyViewModelProps>): void {
        const oldEvent = this.props.mxEvent;
        this.props = { ...this.props, ...newProps };

        if (this.props.mxEvent !== oldEvent) {
            this.decryptedBlob = undefined;
            this.userDidClick = false;
        }

        this.snapshot.set(MFileBodyViewModel.computeSnapshot(this.props, this.decryptedBlob));
    }
}
