/*
Copyright 2015 - 2021 The Matrix.org Foundation C.I.C.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import React, { createRef } from 'react';
import filesize from 'filesize';
import { _t } from '../../../languageHandler';
import Modal from '../../../Modal';
import AccessibleButton from "../elements/AccessibleButton";
import { replaceableComponent } from "../../../utils/replaceableComponent";
import { mediaFromContent } from "../../../customisations/Media";
import ErrorDialog from "../dialogs/ErrorDialog";
import { TileShape } from "../rooms/EventTile";
import { presentableTextForFile } from "../../../utils/FileUtils";
import { IMediaEventContent } from "../../../customisations/models/IMediaEventContent";
import { IBodyProps } from "./IBodyProps";

export let DOWNLOAD_ICON_URL; // cached copy of the download.svg asset for the sandboxed iframe later on

async function cacheDownloadIcon() {
    if (DOWNLOAD_ICON_URL) return; // cached already
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const svg = await fetch(require("../../../../res/img/download.svg")).then(r => r.text());
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
export function computedStyle(element: HTMLElement) {
    if (!element) {
        return "";
    }
    const style = window.getComputedStyle(element, null);
    let cssText = style.cssText;
    // noinspection EqualityComparisonWithCoercionJS
    if (cssText == "") {
        // Firefox doesn't implement ".cssText" for computed styles.
        // https://bugzilla.mozilla.org/show_bug.cgi?id=137687
        for (let i = 0; i < style.length; i++) {
            cssText += style[i] + ":";
            cssText += style.getPropertyValue(style[i]) + ";";
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

@replaceableComponent("views.messages.MFileBody")
export default class MFileBody extends React.Component<IProps, IState> {
    static defaultProps = {
        showGenericPlaceholder: true,
    };

    private iframe: React.RefObject<HTMLIFrameElement> = createRef();
    private dummyLink: React.RefObject<HTMLAnchorElement> = createRef();
    private userDidClick = false;

    public constructor(props: IProps) {
        super(props);

        this.state = {};
    }

    private getContentUrl(): string {
        const media = mediaFromContent(this.props.mxEvent.getContent());
        return media.srcHttp;
    }

    public componentDidUpdate(prevProps, prevState) {
        if (this.props.onHeightChanged && !prevState.decryptedBlob && this.state.decryptedBlob) {
            this.props.onHeightChanged();
        }
    }

    public render() {
        const content = this.props.mxEvent.getContent<IMediaEventContent>();
        const text = presentableTextForFile(content);
        const isEncrypted = this.props.mediaEventHelper.media.isEncrypted;
        const fileName = content.body && content.body.length > 0 ? content.body : _t("Attachment");
        const contentUrl = this.getContentUrl();
        const fileSize = content.info ? content.info.size : null;
        const fileType = content.info ? content.info.mimetype : "application/octet-stream";

        let placeholder = null;
        if (this.props.showGenericPlaceholder) {
            placeholder = (
                <div className="mx_MFileBody_info">
                    <span className="mx_MFileBody_info_icon" />
                    <span className="mx_MFileBody_info_filename">
                        { presentableTextForFile(content, _t("Attachment"), false) }
                    </span>
                </div>
            );
        }

        const showDownloadLink = this.props.tileShape || !this.props.showGenericPlaceholder;

        if (isEncrypted) {
            if (!this.state.decryptedBlob) {
                // Need to decrypt the attachment
                // Wait for the user to click on the link before downloading
                // and decrypting the attachment.
                const decrypt = async () => {
                    try {
                        this.userDidClick = true;
                        this.setState({
                            decryptedBlob: await this.props.mediaEventHelper.sourceBlob.value,
                        });
                    } catch (err) {
                        console.warn("Unable to decrypt attachment: ", err);
                        Modal.createTrackedDialog('Error decrypting attachment', '', ErrorDialog, {
                            title: _t("Error"),
                            description: _t("Error decrypting attachment"),
                        });
                    }
                };

                // This button should actually Download because usercontent/ will try to click itself
                // but it is not guaranteed between various browsers' settings.
                return (
                    <span className="mx_MFileBody">
                        { placeholder }
                        { showDownloadLink && <div className="mx_MFileBody_download">
                            <AccessibleButton onClick={decrypt}>
                                { _t("Decrypt %(text)s", { text: text }) }
                            </AccessibleButton>
                        </div> }
                    </span>
                );
            }

            // When the iframe loads we tell it to render a download link
            const onIframeLoad = (ev) => {
                ev.target.contentWindow.postMessage({
                    imgSrc: DOWNLOAD_ICON_URL,
                    imgStyle: null, // it handles this internally for us. Useful if a downstream changes the icon.
                    style: computedStyle(this.dummyLink.current),
                    blob: this.state.decryptedBlob,
                    // Set a download attribute for encrypted files so that the file
                    // will have the correct name when the user tries to download it.
                    // We can't provide a Content-Disposition header like we would for HTTP.
                    download: fileName,
                    textContent: _t("Download %(text)s", { text: text }),
                    // only auto-download if a user triggered this iframe explicitly
                    auto: this.userDidClick,
                }, "*");
            };

            const url = "usercontent/"; // XXX: this path should probably be passed from the skin

            // If the attachment is encrypted then put the link inside an iframe.
            return (
                <span className="mx_MFileBody">
                    { placeholder }
                    { showDownloadLink && <div className="mx_MFileBody_download">
                        <div style={{ display: "none" }}>
                            { /*
                              * Add dummy copy of the "a" tag
                              * We'll use it to learn how the download link
                              * would have been styled if it was rendered inline.
                              */ }
                            <a ref={this.dummyLink} />
                        </div>
                        <iframe
                            src={url}
                            onLoad={onIframeLoad}
                            ref={this.iframe}
                            sandbox="allow-scripts allow-downloads allow-downloads-without-user-activation" />
                    </div> }
                </span>
            );
        } else if (contentUrl) {
            const downloadProps = {
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
            const fileTooBig = typeof(fileSize) === 'number' ? fileSize > 524288000 : true;

            if (["application/pdf"].includes(fileType) && !fileTooBig) {
                // We want to force a download on this type, so use an onClick handler.
                downloadProps["onClick"] = (e) => {
                    console.log(`Downloading ${fileType} as blob (unencrypted)`);

                    // Avoid letting the <a> do its thing
                    e.preventDefault();
                    e.stopPropagation();

                    // Start a fetch for the download
                    // Based upon https://stackoverflow.com/a/49500465
                    this.props.mediaEventHelper.sourceBlob.value.then((blob) => {
                        const blobUrl = URL.createObjectURL(blob);

                        // We have to create an anchor to download the file
                        const tempAnchor = document.createElement('a');
                        tempAnchor.download = fileName;
                        tempAnchor.href = blobUrl;
                        document.body.appendChild(tempAnchor); // for firefox: https://stackoverflow.com/a/32226068
                        tempAnchor.click();
                        tempAnchor.remove();
                    });
                };
            } else {
                // Else we are hoping the browser will do the right thing
                downloadProps["download"] = fileName;
            }

            return (
                <span className="mx_MFileBody">
                    { placeholder }
                    { showDownloadLink && <div className="mx_MFileBody_download">
                        <a {...downloadProps}>
                            <span className="mx_MFileBody_download_icon" />
                            { _t("Download %(text)s", { text: text }) }
                        </a>
                        { this.props.tileShape === TileShape.FileGrid && <div className="mx_MImageBody_size">
                            { content.info && content.info.size ? filesize(content.info.size) : "" }
                        </div> }
                    </div> }
                </span>
            );
        } else {
            const extra = text ? (': ' + text) : '';
            return <span className="mx_MFileBody">
                { placeholder }
                { _t("Invalid file%(extra)s", { extra: extra }) }
            </span>;
        }
    }
}
