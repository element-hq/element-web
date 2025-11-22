/*
Copyright 2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { logger } from "matrix-js-sdk/src/logger";
import { type MediaEventContent } from "matrix-js-sdk/src/types";
import {
    BaseViewModel,
    type FileBodyViewSnapshot,
    type FileBodyActions,
    type FileInfo,
} from "@element-hq/web-shared-components";
import { createRef } from "react";

import { _t } from "../../languageHandler";
import Modal from "../../Modal";
import { mediaFromContent } from "../../customisations/Media";
import ErrorDialog from "../../components/views/dialogs/ErrorDialog";
import { downloadLabelForFile, presentableTextForFile } from "../../utils/FileUtils";
import { type IBodyProps } from "../../components/views/messages/IBodyProps";
import { FileDownloader } from "../../utils/FileDownloader";
import { TimelineRenderingType } from "../../contexts/RoomContext";
import { computedStyle, DOWNLOAD_ICON_URL } from "../../utils/FileBodyUtils";

export interface MFileBodyViewModelProps extends IBodyProps {
    /* whether or not to show the default placeholder for the file. Defaults to true. */
    showGenericPlaceholder?: boolean;
    timelineRenderingType?: TimelineRenderingType;
}

export class MFileBodyViewModel
    extends BaseViewModel<FileBodyViewSnapshot, MFileBodyViewModelProps>
    implements FileBodyActions
{
    private iframe = createRef<HTMLIFrameElement>();
    private dummyLink = createRef<HTMLAnchorElement>();
    private userDidClick = false;
    private fileDownloader: FileDownloader = new FileDownloader(() => this.iframe.current);
    private decryptedBlob?: Blob;

    public constructor(props: MFileBodyViewModelProps) {
        const snapshot = MFileBodyViewModel.createInitialSnapshot(props);
        super(props, snapshot);
    }

    private static createInitialSnapshot(props: MFileBodyViewModelProps): FileBodyViewSnapshot {
        const content = props.mxEvent.getContent<MediaEventContent>();
        const isEncrypted = props.mediaEventHelper?.media.isEncrypted;
        const contentUrl = MFileBodyViewModel.getContentUrl(props);
        const fileType = content.info?.mimetype ?? "application/octet-stream";
        const showGenericPlaceholder = props.showGenericPlaceholder ?? true;

        let showDownloadLink =
            !showGenericPlaceholder ||
            (props.timelineRenderingType !== TimelineRenderingType.Room &&
                props.timelineRenderingType !== TimelineRenderingType.Search &&
                props.timelineRenderingType !== TimelineRenderingType.Pinned);

        if (props.timelineRenderingType === TimelineRenderingType.Thread) {
            showDownloadLink = false;
        }

        const fileInfo: FileInfo = {
            filename: presentableTextForFile(content, _t("common|attachment"), true, true),
            tooltip: presentableTextForFile(content, _t("common|attachment"), true),
            mimeType: fileType,
        };

        const downloadLabel = downloadLabelForFile(content, true);

        // Export mode
        if (props.forExport) {
            return {
                fileInfo,
                downloadLabel,
                showGenericPlaceholder,
                showDownloadLink,
                isEncrypted: false,
                isDecrypted: false,
                forExport: true,
                exportUrl: content.file?.url || content.url,
            };
        }

        // Error state
        if (!isEncrypted && !contentUrl) {
            return {
                fileInfo,
                downloadLabel,
                showGenericPlaceholder,
                showDownloadLink,
                isEncrypted: false,
                isDecrypted: false,
                forExport: false,
                error: _t("timeline|m.file|error_invalid"),
            };
        }

        // Initial state for encrypted or unencrypted files
        return {
            fileInfo,
            downloadLabel,
            showGenericPlaceholder,
            showDownloadLink,
            isEncrypted: !!isEncrypted,
            isDecrypted: false,
            forExport: false,
        };
    }

    private static getContentUrl(props: MFileBodyViewModelProps): string | null {
        if (props.forExport) return null;
        const media = mediaFromContent(props.mxEvent.getContent());
        return media.srcHttp;
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
                style: computedStyle(this.dummyLink.current),
                textContent: text,
            },
        });
    }

    private decryptFile = async (): Promise<void> => {
        if (this.decryptedBlob) {
            return;
        }
        try {
            this.userDidClick = true;
            this.decryptedBlob = await this.props.mediaEventHelper!.sourceBlob.value;

            // Update snapshot to reflect decrypted state
            this.snapshot.merge({
                isDecrypted: true,
                iframeSrc: "usercontent/",
                iframeRef: this.iframe,
                dummyLinkRef: this.dummyLink,
            });
        } catch (err) {
            logger.warn("Unable to decrypt attachment: ", err);
            Modal.createDialog(ErrorDialog, {
                title: _t("common|error"),
                description: _t("timeline|m.file|error_decrypting"),
            });
        }
    };

    public get onPlaceholderClick(): (() => void) | undefined {
        return async () => {
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
    }

    public get onDownloadClick(): ((e: React.MouseEvent) => void) | undefined {
        const current = this.snapshot.current;
        if (current.isEncrypted && !current.isDecrypted) {
            return undefined;
        }

        return (e: React.MouseEvent) => {
            logger.log(
                `Downloading ${this.content.info?.mimetype ?? "application/octet-stream"} as blob (unencrypted)`,
            );

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
    }

    public get onDecryptClick(): ((e: React.MouseEvent) => void) | undefined {
        const current = this.snapshot.current;
        if (!current.isEncrypted || current.isDecrypted) {
            return undefined;
        }

        return async (e: React.MouseEvent) => {
            e.preventDefault();
            e.stopPropagation();
            await this.decryptFile();
        };
    }

    public get onIframeLoad(): (() => void) | undefined {
        const current = this.snapshot.current;
        if (!current.isEncrypted || !current.isDecrypted) {
            return undefined;
        }

        return () => this.downloadFile(this.fileName, this.linkText);
    }
}
