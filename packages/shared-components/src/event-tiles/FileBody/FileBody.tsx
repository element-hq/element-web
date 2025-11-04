/*
Copyright 2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { Button } from "@vector-im/compound-web";
import { DownloadIcon } from "@vector-im/compound-design-tokens/assets/web/icons";
import classNames from "classnames";

import styles from "./FileBody.module.css";

export interface FileInfo {
    /** The filename to display */
    filename: string;
    /** The tooltip text for the file */
    tooltip: string;
    /** MIME type of the file */
    mimeType?: string;
}

export interface FileBodyProps {
    /** Information about the file to display */
    fileInfo: FileInfo;
    /** The text to display on the download button */
    downloadLabel: string;
    /** Whether to show the generic file placeholder */
    showGenericPlaceholder?: boolean;
    /** Whether to show the download link */
    showDownloadLink?: boolean;
    /** Whether the file is encrypted */
    isEncrypted?: boolean;
    /** Whether an encrypted file has been decrypted */
    isDecrypted?: boolean;
    /** Whether this is for export mode */
    forExport?: boolean;
    /** The URL for export mode links */
    exportUrl?: string;
    /** Error message to display instead of file content */
    error?: string;
    /** Called when the placeholder is clicked */
    onPlaceholderClick?: () => void;
    /** Called when the download button is clicked (for unencrypted files) */
    onDownloadClick?: (e: React.MouseEvent) => void;
    /** Called when the decrypt button is clicked */
    onDecryptClick?: (e: React.MouseEvent) => void;
    /** Called when iframe loads (for encrypted, decrypted files) */
    onIframeLoad?: () => void;
    /** The iframe src URL for encrypted downloads */
    iframeSrc?: string;
    /** Ref for the iframe element */
    iframeRef?: React.RefObject<HTMLIFrameElement | null>;
    /** Ref for the dummy download link (for styling encrypted downloads) */
    dummyLinkRef?: React.RefObject<HTMLAnchorElement | null>;
    /** Additional className for the root element */
    className?: string;
}

/**
 * FileBody is a presentational component for displaying file attachments.
 * It handles the UI for encrypted/unencrypted files, download buttons, and placeholders.
 */
export class FileBody extends React.Component<FileBodyProps> {
    private renderPlaceholder(): React.ReactNode {
        const { fileInfo, onPlaceholderClick } = this.props;

        return (
            <button
                type="button"
                className={classNames("mx_MediaBody", styles.info, "mx_MFileBody_info")}
                onClick={onPlaceholderClick}
            >
                <span className={classNames(styles.infoIcon, "mx_MFileBody_info_icon")} />
                <span
                    className={classNames(styles.infoFilename, "mx_MFileBody_info_filename")}
                    title={fileInfo.tooltip}
                >
                    {fileInfo.filename}
                </span>
            </button>
        );
    }

    private renderDownloadButton(): React.ReactNode {
        const { downloadLabel, isEncrypted, isDecrypted, onDecryptClick, onDownloadClick } = this.props;

        // For encrypted files that haven't been decrypted yet
        if (isEncrypted && !isDecrypted) {
            return (
                <div className={classNames(styles.download, "mx_MFileBody_download")}>
                    <Button size="sm" kind="secondary" Icon={DownloadIcon} onClick={onDecryptClick}>
                        {downloadLabel}
                    </Button>
                </div>
            );
        }

        // For encrypted files that have been decrypted (with iframe)
        if (isEncrypted && isDecrypted) {
            const { iframeSrc, onIframeLoad, iframeRef, dummyLinkRef, fileInfo } = this.props;
            return (
                <div className={classNames(styles.download, "mx_MFileBody_download")}>
                    <div aria-hidden style={{ display: "none" }}>
                        {/* Dummy copy of the button for style calculation */}
                        <Button size="sm" kind="secondary" Icon={DownloadIcon} as="a" ref={dummyLinkRef} />
                    </div>
                    <iframe
                        aria-hidden
                        title={fileInfo.filename}
                        src={iframeSrc}
                        onLoad={onIframeLoad}
                        ref={iframeRef}
                        sandbox="allow-scripts allow-downloads"
                    />
                </div>
            );
        }

        // For unencrypted files
        return (
            <div className={classNames(styles.download, "mx_MFileBody_download")}>
                <Button size="sm" kind="secondary" Icon={DownloadIcon} as="a" onClick={onDownloadClick}>
                    {downloadLabel}
                </Button>
            </div>
        );
    }

    public render(): React.ReactNode {
        const {
            showGenericPlaceholder = true,
            showDownloadLink = true,
            forExport,
            exportUrl,
            error,
            className,
        } = this.props;

        const placeholder = showGenericPlaceholder ? this.renderPlaceholder() : null;

        // Export mode
        if (forExport && exportUrl) {
            return (
                <span className={classNames(styles.root, "mx_MFileBody", className)}>
                    <a href={exportUrl}>{placeholder}</a>
                </span>
            );
        }

        // Error state
        if (error) {
            return (
                <span className={classNames(styles.root, "mx_MFileBody", className)}>
                    {placeholder}
                    <span>{error}</span>
                </span>
            );
        }

        // Normal display
        return (
            <span className={classNames(styles.root, "mx_MFileBody", className)}>
                {placeholder}
                {showDownloadLink && this.renderDownloadButton()}
            </span>
        );
    }
}
