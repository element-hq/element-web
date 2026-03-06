/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX, type MouseEvent } from "react";
import classNames from "classnames";
import { Button, Tooltip } from "@vector-im/compound-web";
import {
    AttachmentIcon,
    DownloadIcon,
    VideoCallSolidIcon,
    VolumeOnSolidIcon,
} from "@vector-im/compound-design-tokens/assets/web/icons";

import styles from "./FileBodyView.module.css";
import { type ViewModel } from "../../viewmodel/ViewModel";
import { useViewModel } from "../../viewmodel/useViewModel";
import { useI18n } from "../../utils/i18nContext";
import { MediaBody } from "../MediaBody";

/**
 * Which visual state to render for the component.
 */
export enum FileBodyViewRendering {
    EXPORT = "EXPORT",
    ENCRYPTED_PENDING = "ENCRYPTED_PENDING",
    ENCRYPTED_IFRAME = "ENCRYPTED_IFRAME",
    UNENCRYPTED = "UNENCRYPTED",
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
     * Controls the overall flow (export, encrypted, unencrypted, invalid).
     */
    rendering: FileBodyViewRendering;
    /**
     * Whether to render the info row (icon + label + tooltip).
     */
    infoShow?: boolean;
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
    downloadShow?: boolean;
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
 * Renders the body of a file message for info, export, and download flows.
 *
 * Rendering is selected by `snapshot.rendering` from the view model and supports:
 * - export link (`EXPORT`)
 * - encrypted download flows (`ENCRYPTED_PENDING`, `ENCRYPTED_IFRAME`)
 * - unencrypted download flow (`UNENCRYPTED`)
 * - invalid-file fallback (`INVALID`)
 *
 * Visibility/content for the info row and download controls are driven by snapshot fields:
 * - `infoShow`, `infoLabel`, `infoTooltip`, `infoIcon`, `infoHref`
 * - `downloadShow`, `downloadLabel`, `downloadTitle`, `downloadHref`
 *
 * Common usage patterns:
 * - info-only display: set `infoShow: true`, `downloadShow: false`
 * - export link (`EXPORT`)
 * - download-only display: set `infoShow: false`, `downloadShow: true`
 *
 * Labels and titles are resolved from snapshot values with i18n fallbacks.
 *
 * @example
 * ```tsx
 * <FileBodyView vm={fileBodyViewModel} />
 * ```
 */
export function FileBodyView({ vm, refIFrame, refLink, className }: Readonly<FileBodyViewProps>): JSX.Element {
    const { translate: _t } = useI18n();
    const {
        rendering,
        infoShow,
        infoLabel,
        infoTooltip,
        infoIcon,
        infoHref,
        downloadShow,
        downloadLabel,
        downloadTitle,
        downloadHref,
    } = useViewModel(vm);

    const resolvedInfoLabel = infoLabel ?? _t("common|attachment");
    const resolvedInfoTooltip = infoTooltip ?? resolvedInfoLabel;

    let resolvedInfoIcon = AttachmentIcon;
    if (infoIcon === FileBodyViewInfoIcon.AUDIO) {
        resolvedInfoIcon = VolumeOnSolidIcon;
    } else if (infoIcon === FileBodyViewInfoIcon.ATTACHMENT) {
        resolvedInfoIcon = AttachmentIcon;
    } else if (infoIcon === FileBodyViewInfoIcon.VIDEO) {
        resolvedInfoIcon = VideoCallSolidIcon;
    }

    const info = infoShow ? (
        <MediaBody data-type="info" onClick={vm.onInfoClick} role="button" tabIndex={0}>
            <span data-type="info-icon">{React.createElement(resolvedInfoIcon)}</span>
            <Tooltip description={resolvedInfoTooltip} placement="right">
                <span data-type="info-label">{resolvedInfoLabel}</span>
            </Tooltip>
        </MediaBody>
    ) : null;

    const classes = classNames(styles.content, className);

    const resolvedDownloadLabel = downloadLabel ?? _t("action|download");
    const resolvedDownloadTitle = downloadTitle ?? resolvedDownloadLabel;

    switch (rendering) {
        case FileBodyViewRendering.EXPORT:
            return (
                <span className={classes}>
                    <a href={infoHref}>{info}</a>
                </span>
            );

        case FileBodyViewRendering.ENCRYPTED_PENDING:
            return (
                <span className={classes}>
                    {info}
                    {downloadShow && (
                        <div data-type="download">
                            {/* Decrypt/download is triggered by the view model action, not by an anchor `href`. */}
                            <Button size="sm" kind="secondary" Icon={DownloadIcon} onClick={vm.onDownloadClick}>
                                {resolvedDownloadLabel}
                            </Button>
                        </div>
                    )}
                </span>
            );

        case FileBodyViewRendering.ENCRYPTED_IFRAME:
            return (
                <span className={classes}>
                    {info}
                    {downloadShow && (
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

        case FileBodyViewRendering.UNENCRYPTED:
            return (
                <span className={classes}>
                    {info}
                    {downloadShow && (
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

        case FileBodyViewRendering.INVALID:
        default:
            return (
                <>
                    <span className={classes}>{info}</span>
                    <span className={styles.invalid}>{_t("timeline|m.file|error_invalid")}</span>
                </>
            );
    }
}
