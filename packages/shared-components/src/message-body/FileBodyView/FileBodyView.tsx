/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type ComponentType, type JSX, type MouseEvent } from "react";
import classNames from "classnames";
import { Button, Tooltip } from "@vector-im/compound-web";
import {
    AttachmentIcon,
    DownloadIcon,
    VideoCallSolidIcon,
    VolumeOnSolidIcon,
} from "@vector-im/compound-design-tokens/assets/web/icons";

import styles from "./FileBodyView.module.css";
import { type ViewModel } from "../../core/viewmodel/ViewModel";
import { useViewModel } from "../../core/viewmodel/useViewModel";
import { useI18n } from "../../core/i18n/i18nContext";
import { MediaBody } from "../../room/timeline/event-tile/body/MediaBody";

/**
 * Which visual state to render for the component.
 */
export enum FileBodyViewState {
    /** Export-only rendering where the info row links to the source file. */
    EXPORT = "EXPORT",
    /** Encrypted file before decryption has completed; shows the button that starts the flow. */
    DECRYPTION_PENDING = "DECRYPTION_PENDING",
    /** Encrypted file after decryption; renders the sandboxed iframe download path. */
    ENCRYPTED = "ENCRYPTED",
    /** Unencrypted file with a direct download link. */
    UNENCRYPTED = "UNENCRYPTED",
    /** Fallback for missing or unusable file metadata. */
    INVALID = "INVALID",
}

/**
 * Which info icon to render.
 */
export enum FileBodyViewInfoIcon {
    ATTACHMENT = "ATTACHMENT",
    AUDIO = "AUDIO",
    DOWNLOAD = "DOWNLOAD",
    VIDEO = "VIDEO",
}

export interface FileBodyViewSnapshot {
    /**
     * Primary rendering branch for the component.
     * Controls the overall state (export, encrypted, unencrypted, invalid).
     */
    state: FileBodyViewState;
    /**
     * Whether to render the info row (icon + label + tooltip).
     */
    showInfo?: boolean;
    /**
     * Optional info label (normally the file name). Defaults to 'Attachment'.
     */
    infoLabel?: string;
    /**
     * Optional tooltip for info button. Defaults to infoLabel.
     */
    infoTooltip?: string;
    /**
     * Optional icon. Defaults to `ATTACHMENT`.
     */
    infoIcon?: FileBodyViewInfoIcon;
    /**
     * Optional URL used by the info row in `EXPORT`.
     */
    infoHref?: string;
    /**
     * Whether to render download controls for the current rendering branch.
     */
    showDownload?: boolean;
    /**
     * Optional download label (normally file/action text). Defaults to 'Download'.
     */
    downloadLabel?: string;
    /**
     * Optional title for encrypted iframe download flow.
     * Defaults to `downloadLabel`.
     */
    downloadTitle?: string;
    /**
     * Optional URL used for `UNENCRYPTED` download links.
     */
    downloadHref?: string;
}

export interface FileBodyViewActions {
    /**
     * Click handler for the info row.
     */
    onInfoClick?: () => void;
    /**
     * Click handler for a download button.
     */
    onDownloadClick?: () => void;
    /**
     * Click handler for the unencrypted download anchor.
     */
    onDownloadLinkClick?: (event: MouseEvent<HTMLAnchorElement>) => void;
    /**
     * Load handler for encrypted-download iframe.
     */
    onDownloadIframeLoad?: () => void;
}

/**
 * The view model for the control.
 */
export type FileBodyViewModel = ViewModel<FileBodyViewSnapshot> & FileBodyViewActions;

interface FileBodyViewProps {
    /**
     * The view model for the component.
     */
    vm: FileBodyViewModel;

    /**
     * Optional CSS class for host-level styling.
     */
    className?: string;

    /**
     * Optional iframe ref for encrypted download flow
     */
    refIFrame?: React.RefObject<HTMLIFrameElement>;

    /**
     * Optional hidden anchor ref used for encrypted download flow
     */
    refLink?: React.RefObject<HTMLAnchorElement>;
}

/**
 * Create the correct icon to render in the view
 */
function getInfoIcon(infoIcon?: FileBodyViewInfoIcon): ComponentType<React.SVGAttributes<SVGElement>> {
    if (infoIcon === FileBodyViewInfoIcon.AUDIO) {
        return VolumeOnSolidIcon;
    } else if (infoIcon === FileBodyViewInfoIcon.DOWNLOAD) {
        return DownloadIcon;
    } else if (infoIcon === FileBodyViewInfoIcon.VIDEO) {
        return VideoCallSolidIcon;
    }
    return AttachmentIcon;
}

/**
 * Renders the body of a file message for info, export, and download flows.
 *
 * Rendering is selected by `snapshot.state` from the view model and supports:
 * - export link (`EXPORT`)
 * - encrypted download flows (`DECRYPTION_PENDING`, `ENCRYPTED`)
 * - unencrypted download flow (`UNENCRYPTED`)
 * - invalid-file fallback (`INVALID`)
 *
 * Visibility/content for the info row and download controls are driven by snapshot fields:
 * - `showInfo`, `infoLabel`, `infoTooltip`, `infoIcon`, `infoHref`
 * - `showDownload`, `downloadLabel`, `downloadTitle`, `downloadHref`
 *
 * Common usage patterns:
 * - info-only display: set `showInfo: true`, `showDownload: false`
 * - export link (`EXPORT`)
 * - download-only display: set `showInfo: false`, `showDownload: true`
 *
 * Note on using the encrypted iframe, `ENCRYPTED`:
 * To make this rendering branch work, it is expected that a `usercontent/` target
 * is available relative to the root of the application as is described in detail here,
 * https://github.com/element-hq/element-web/blob/develop/docs/usercontent.md
 *
 * @example
 * ```tsx
 * <FileBodyView vm={fileBodyViewModel} />
 * ```
 */
export function FileBodyView({ vm, refIFrame, refLink, className }: Readonly<FileBodyViewProps>): JSX.Element {
    const { translate: _t } = useI18n();

    const {
        state,
        showInfo,
        infoLabel,
        infoTooltip,
        infoIcon,
        infoHref,
        showDownload,
        downloadLabel,
        downloadTitle,
        downloadHref,
    } = useViewModel(vm);

    const resolvedInfoLabel = infoLabel ?? _t("common|attachment");
    const resolvedInfoTooltip = infoTooltip ?? resolvedInfoLabel;
    const resolvedInfoIcon = getInfoIcon(infoIcon);

    const info = showInfo ? (
        <Tooltip description={resolvedInfoTooltip} placement="right">
            <MediaBody data-type="info">
                <Button
                    as="button"
                    size="sm"
                    kind="secondary"
                    aria-label={resolvedInfoLabel}
                    Icon={resolvedInfoIcon}
                    onClick={vm.onInfoClick}
                >
                    <span>{resolvedInfoLabel}</span>
                </Button>
            </MediaBody>
        </Tooltip>
    ) : null;

    const classes = classNames(styles.content, className);

    const resolvedDownloadLabel = downloadLabel ?? _t("action|download");
    const resolvedDownloadTitle = downloadTitle ?? resolvedDownloadLabel;

    switch (state) {
        case FileBodyViewState.EXPORT:
            return (
                <span className={classes}>
                    <a href={infoHref}>{info}</a>
                </span>
            );

        case FileBodyViewState.DECRYPTION_PENDING:
            return (
                <span className={classes}>
                    {info}
                    {showDownload && (
                        <div data-type="download">
                            {/* Decrypt/download is triggered by the view model action, not by an anchor `href`. */}
                            <Button size="sm" kind="secondary" Icon={DownloadIcon} onClick={vm.onDownloadClick}>
                                {resolvedDownloadLabel}
                            </Button>
                        </div>
                    )}
                </span>
            );

        case FileBodyViewState.ENCRYPTED:
            return (
                <span className={classes}>
                    {info}
                    {showDownload && (
                        <div data-type="download">
                            <div aria-hidden style={{ display: "none" }}>
                                {/*
                                 * Add dummy copy of the button
                                 * We'll use it to learn how the download button
                                 * would have been styled if it was rendered inline.
                                 * this violates multiple eslint rules so ignore it completely */}
                                <Button size="sm" kind="secondary" Icon={DownloadIcon} as="a" ref={refLink} />
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
                                title={resolvedDownloadTitle}
                                src="usercontent/"
                                onLoad={vm.onDownloadIframeLoad}
                                ref={refIFrame}
                                sandbox="allow-scripts allow-downloads"
                            />
                        </div>
                    )}
                </span>
            );

        case FileBodyViewState.UNENCRYPTED:
            return (
                <span className={classes}>
                    {info}
                    {showDownload && (
                        <div data-type="download">
                            {/* Unencrypted media uses an anchor element with VM-controlled click behavior. */}
                            <Button
                                size="sm"
                                kind="secondary"
                                Icon={DownloadIcon}
                                as="a"
                                href={downloadHref}
                                target="_blank"
                                rel="noreferrer noopener"
                                onClick={vm.onDownloadLinkClick}
                            >
                                {resolvedDownloadLabel}
                            </Button>
                        </div>
                    )}
                </span>
            );

        case FileBodyViewState.INVALID:
        default:
            return (
                <>
                    <span className={classes}>{info}</span>
                    <span className={classNames(classes, styles.invalid)}>{_t("timeline|m.file|error_invalid")}</span>
                </>
            );
    }
}
