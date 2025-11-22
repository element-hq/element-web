/*
Copyright 2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX } from "react";
import { Button } from "@vector-im/compound-web";
import { DownloadIcon } from "@vector-im/compound-design-tokens/assets/web/icons";
import classNames from "classnames";

import styles from "./FileBody.module.css";
import { type ViewModel } from "../../viewmodel/ViewModel";
import { useViewModel } from "../../useViewModel";

export interface FileInfo {
    /** The filename to display */
    filename: string;
    /** The tooltip text for the file */
    tooltip: string;
    /** MIME type of the file */
    mimeType?: string;
}

/**
 * Snapshot of the FileBody view state
 */
export interface FileBodyViewSnapshot {
    /** Information about the file to display */
    fileInfo: FileInfo;
    /** The text to display on the download button */
    downloadLabel: string;
    /** Whether to show the generic file placeholder */
    showGenericPlaceholder: boolean;
    /** Whether to show the download link */
    showDownloadLink: boolean;
    /** Whether the file is encrypted */
    isEncrypted: boolean;
    /** Whether an encrypted file has been decrypted */
    isDecrypted: boolean;
    /** Whether this is for export mode */
    forExport: boolean;
    /** The URL for export mode links */
    exportUrl?: string;
    /** Error message to display instead of file content */
    error?: string;
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
 * Actions that can be performed on the FileBody
 */
export interface FileBodyActions {
    /** Called when the placeholder is clicked */
    onPlaceholderClick?: () => void;
    /** Called when the download button is clicked (for unencrypted files) */
    onDownloadClick?: (e: React.MouseEvent) => void;
    /** Called when the decrypt button is clicked */
    onDecryptClick?: (e: React.MouseEvent) => void;
    /** Called when iframe loads (for encrypted, decrypted files) */
    onIframeLoad?: () => void;
}

/**
 * ViewModel type for FileBody component
 */
export type FileBodyViewModel = ViewModel<FileBodyViewSnapshot> & FileBodyActions;

export interface FileBodyProps {
    vm: FileBodyViewModel;
}

/**
 * FileBody is a presentational component for displaying file attachments.
 * It handles the UI for encrypted/unencrypted files, download buttons, and placeholders.
 */
export function FileBody({ vm }: FileBodyProps): JSX.Element {
    const {
        fileInfo,
        downloadLabel,
        showGenericPlaceholder,
        showDownloadLink,
        isEncrypted,
        isDecrypted,
        forExport,
        exportUrl,
        error,
        iframeSrc,
        iframeRef,
        dummyLinkRef,
        className,
    } = useViewModel(vm);

    const renderPlaceholder = (): React.ReactNode => {
        return (
            <button
                type="button"
                className={classNames("mx_MediaBody", styles.info, "mx_MFileBody_info")}
                onClick={vm.onPlaceholderClick}
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
    };

    const renderDownloadButton = (): React.ReactNode => {
        // For encrypted files that haven't been decrypted yet
        if (isEncrypted && !isDecrypted) {
            return (
                <div className={classNames(styles.download, "mx_MFileBody_download")}>
                    <Button size="sm" kind="secondary" Icon={DownloadIcon} onClick={vm.onDecryptClick}>
                        {downloadLabel}
                    </Button>
                </div>
            );
        }

        // For encrypted files that have been decrypted (with iframe)
        if (isEncrypted && isDecrypted) {
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
                        onLoad={vm.onIframeLoad}
                        ref={iframeRef}
                        sandbox="allow-scripts allow-downloads"
                    />
                </div>
            );
        }

        // For unencrypted files
        return (
            <div className={classNames(styles.download, "mx_MFileBody_download")}>
                <Button size="sm" kind="secondary" Icon={DownloadIcon} as="a" onClick={vm.onDownloadClick}>
                    {downloadLabel}
                </Button>
            </div>
        );
    };

    const placeholder = showGenericPlaceholder ? renderPlaceholder() : null;

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
            {showDownloadLink && renderDownloadButton()}
        </span>
    );
}
