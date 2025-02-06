/*
Copyright 2024 New Vector Ltd.
Copyright 2015-2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type AllHTMLAttributes, createRef } from "react";
import { logger } from "matrix-js-sdk/src/logger";
import { type MediaEventContent } from "matrix-js-sdk/src/types";
import { Button } from "@vector-im/compound-web";
import { DownloadIcon } from "@vector-im/compound-design-tokens/assets/web/icons";

import { _t } from "../../../languageHandler";
import Modal from "../../../Modal";
import AccessibleButton from "../elements/AccessibleButton";
import { mediaFromContent } from "../../../customisations/Media";
import ErrorDialog from "../dialogs/ErrorDialog";
import { downloadLabelForFile, presentableTextForFile } from "../../../utils/FileUtils";
import { type IBodyProps } from "./IBodyProps";
import { FileDownloader } from "../../../utils/FileDownloader";
import TextWithTooltip from "../elements/TextWithTooltip";
import RoomContext, { TimelineRenderingType } from "../../../contexts/RoomContext";

export let DOWNLOAD_ICON_URL: string; // cached copy of the download.svg asset for the sandboxed iframe later on

async function cacheDownloadIcon(): Promise<void> {
    if (DOWNLOAD_ICON_URL) return; // cached already
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
export function computedStyle(element: HTMLElement | null): string {
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

interface IProps extends IBodyProps {
    /* whether or not to show the default placeholder for the file. Defaults to true. */
    showGenericPlaceholder: boolean;
}

interface IState {
    decryptedBlob?: Blob;
}

export default class MFileBody extends React.Component<IProps, IState> {
    public static contextType = RoomContext;
    declare public context: React.ContextType<typeof RoomContext>;

    public state: IState = {};

    public static defaultProps = {
        showGenericPlaceholder: true,
    };

    private iframe: React.RefObject<HTMLIFrameElement> = createRef();
    private dummyLink: React.RefObject<HTMLAnchorElement> = createRef();
    private userDidClick = false;
    private fileDownloader: FileDownloader = new FileDownloader(() => this.iframe.current);

    private getContentUrl(): string | null {
        if (this.props.forExport) return null;
        const media = mediaFromContent(this.props.mxEvent.getContent());
        return media.srcHttp;
    }
    private get content(): MediaEventContent {
        return this.props.mxEvent.getContent<MediaEventContent>();
    }

    private get fileName(): string {
        return this.content.body && this.content.body.length > 0 ? this.content.body : _t("common|attachment");
    }

    private get linkText(): string {
        return downloadLabelForFile(this.content, true);
    }

    private downloadFile(fileName: string, text: string): void {
        if (!this.state.decryptedBlob) return;
        this.fileDownloader.download({
            blob: this.state.decryptedBlob,
            name: fileName,
            autoDownload: this.userDidClick,
            opts: {
                imgSrc: DOWNLOAD_ICON_URL,
                imgStyle: null,
                style: computedStyle(this.dummyLink.current),
                textContent: text,
            },
        });
    }

    public componentDidUpdate(prevProps: IProps, prevState: IState): void {
        if (this.props.onHeightChanged && !prevState.decryptedBlob && this.state.decryptedBlob) {
            this.props.onHeightChanged();
        }
    }

    private decryptFile = async (): Promise<void> => {
        if (this.state.decryptedBlob) {
            return;
        }
        try {
            this.userDidClick = true;
            this.setState({
                decryptedBlob: await this.props.mediaEventHelper!.sourceBlob.value,
            });
        } catch (err) {
            logger.warn("Unable to decrypt attachment: ", err);
            Modal.createDialog(ErrorDialog, {
                title: _t("common|error"),
                description: _t("timeline|m.file|error_decrypting"),
            });
        }
    };

    private onPlaceholderClick = async (): Promise<void> => {
        const mediaHelper = this.props.mediaEventHelper;
        if (mediaHelper?.media.isEncrypted) {
            await this.decryptFile();
            this.downloadFile(this.fileName, this.linkText);
        } else {
            // As a button we're missing the `download` attribute for styling reasons, so
            // download with the file downloader.
            this.fileDownloader.download({
                blob: await mediaHelper!.sourceBlob.value,
                name: this.fileName,
            });
        }
    };

    public render(): React.ReactNode {
        const isEncrypted = this.props.mediaEventHelper?.media.isEncrypted;
        const contentUrl = this.getContentUrl();
        const contentFileSize = this.content.info ? this.content.info.size : null;
        const fileType = this.content.info?.mimetype ?? "application/octet-stream";

        let showDownloadLink =
            !this.props.showGenericPlaceholder ||
            (this.context.timelineRenderingType !== TimelineRenderingType.Room &&
                this.context.timelineRenderingType !== TimelineRenderingType.Search &&
                this.context.timelineRenderingType !== TimelineRenderingType.Pinned);

        let placeholder: React.ReactNode = null;
        if (this.props.showGenericPlaceholder) {
            placeholder = (
                <AccessibleButton className="mx_MediaBody mx_MFileBody_info" onClick={this.onPlaceholderClick}>
                    <span className="mx_MFileBody_info_icon" />
                    <TextWithTooltip tooltip={presentableTextForFile(this.content, _t("common|attachment"), true)}>
                        <span className="mx_MFileBody_info_filename">
                            {presentableTextForFile(this.content, _t("common|attachment"), true, true)}
                        </span>
                    </TextWithTooltip>
                </AccessibleButton>
            );
            showDownloadLink = false;
        }

        if (this.props.forExport) {
            const content = this.props.mxEvent.getContent();
            // During export, the content url will point to the MSC, which will later point to a local url
            return (
                <span className="mx_MFileBody">
                    <a href={content.file?.url || content.url}>{placeholder}</a>
                </span>
            );
        }

        if (this.context.timelineRenderingType === TimelineRenderingType.Thread) {
            showDownloadLink = false;
        }

        if (isEncrypted) {
            if (!this.state.decryptedBlob) {
                // Need to decrypt the attachment
                // Wait for the user to click on the link before downloading
                // and decrypting the attachment.

                // This button should actually Download because usercontent/ will try to click itself
                // but it is not guaranteed between various browsers' settings.
                return (
                    <span className="mx_MFileBody">
                        {placeholder}
                        {showDownloadLink && (
                            <div className="mx_MFileBody_download">
                                <Button size="sm" kind="secondary" Icon={DownloadIcon} onClick={this.decryptFile}>
                                    {this.linkText}
                                </Button>
                            </div>
                        )}
                    </span>
                );
            }

            const url = "usercontent/"; // XXX: this path should probably be passed from the skin

            // If the attachment is encrypted then put the link inside an iframe.
            return (
                <span className="mx_MFileBody">
                    {placeholder}
                    {showDownloadLink && (
                        <div className="mx_MFileBody_download">
                            <div aria-hidden style={{ display: "none" }}>
                                {/*
                                 * Add dummy copy of the button
                                 * We'll use it to learn how the download button
                                 * would have been styled if it was rendered inline.
                                 */}
                                {/* this violates multiple eslint rules
                            so ignore it completely */}
                                <Button size="sm" kind="secondary" Icon={DownloadIcon} as="a" ref={this.dummyLink} />
                            </div>
                            {/*
                            TODO: Move iframe (and dummy link) into FileDownloader.
                            We currently have it set up this way because of styles applied to the iframe
                            itself which cannot be easily handled/overridden by the FileDownloader. In
                            future, the download link may disappear entirely at which point it could also
                            be suitable to just remove this bit of code.
                         */}
                            <iframe
                                aria-hidden
                                title={presentableTextForFile(this.content, _t("common|attachment"), true, true)}
                                src={url}
                                onLoad={() => this.downloadFile(this.fileName, this.linkText)}
                                ref={this.iframe}
                                sandbox="allow-scripts allow-downloads"
                            />
                        </div>
                    )}
                </span>
            );
        } else if (contentUrl) {
            const downloadProps: Pick<
                AllHTMLAttributes<HTMLAnchorElement>,
                "target" | "rel" | "href" | "onClick" | "download"
            > = {
                target: "_blank",
                rel: "noreferrer noopener",

                // We set the href regardless of whether or not we intercept the download
                // because we don't really want to convert the file to a blob eagerly, and
                // still want "open in new tab" and "save link as" to work.
                href: contentUrl,
            };

            // Blobs can only have up to 500mb, so if the file reports as being too large then
            // we won't try and convert it. Likewise, if the file size is unknown then we'll assume
            // it is too big. There is the risk of the reported file size and the actual file size
            // being different, however the user shouldn't normally run into this problem.
            const fileTooBig = typeof contentFileSize === "number" ? contentFileSize > 524288000 : true;

            if (["application/pdf"].includes(fileType) && !fileTooBig) {
                // We want to force a download on this type, so use an onClick handler.
                downloadProps["onClick"] = (e) => {
                    logger.log(`Downloading ${fileType} as blob (unencrypted)`);

                    // Avoid letting the <a> do its thing
                    e.preventDefault();
                    e.stopPropagation();

                    // Start a fetch for the download
                    // Based upon https://stackoverflow.com/a/49500465
                    this.props.mediaEventHelper?.sourceBlob.value.then((blob) => {
                        const blobUrl = URL.createObjectURL(blob);

                        // We have to create an anchor to download the file
                        const tempAnchor = document.createElement("a");
                        tempAnchor.download = this.fileName;
                        tempAnchor.href = blobUrl;
                        document.body.appendChild(tempAnchor); // for firefox: https://stackoverflow.com/a/32226068
                        tempAnchor.click();
                        tempAnchor.remove();
                    });
                };
            } else {
                // Else we are hoping the browser will do the right thing
                downloadProps["download"] = this.fileName;
            }

            return (
                <span className="mx_MFileBody">
                    {placeholder}
                    {showDownloadLink && (
                        <div className="mx_MFileBody_download">
                            <Button size="sm" kind="secondary" Icon={DownloadIcon} as="a" {...downloadProps}>
                                {this.linkText}
                            </Button>
                        </div>
                    )}
                </span>
            );
        } else {
            return (
                <span className="mx_MFileBody">
                    {placeholder}
                    {_t("timeline|m.file|error_invalid")}
                </span>
            );
        }
    }
}
