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

import styles from "./MFileBodyView.module.css";
import { type ViewModel } from "../../viewmodel/ViewModel";
import { useViewModel } from "../../viewmodel/useViewModel";
import { useI18n } from "../../utils/i18nContext";

/**
 * Which visual state to render for the file body.
 */
export enum MFileBodyViewRendering {
    ENCRYPTED_PENDING = "ENCRYPTED_PENDING",
    ENCRYPTED_IFRAME_DOWNLOAD = "ENCRYPTED_IFRAME_DOWNLOAD",
    UNENCRYPTED_DOWNLOAD = "UNENCRYPTED_DOWNLOAD",
    EXPORT = "EXPORT",
    INVALID = "INVALID",
}

/**
 * Which info icon to render.
 */
export enum MFileBodyViewinfoIcon {
    ATTACHMENT = "ATTACHMENT",
    AUDIO = "AUDIO",
    VIDEO = "VIDEO",
}

export interface MFileBodyViewSnapshot {
    /**
     * Rendering branch for the component.
     */
    rendering: MFileBodyViewRendering;
    /**
     * Visible info label (normally the file name).
     */
    filename: string;
    /**
     * Whether to show the generic info row.
     */
    showInfo?: boolean;
    /**
     * Optional tooltip text for the info.
     */
    infoTooltip?: string;
    /**
     * info icon variant.
     */
    infoIcon?: MFileBodyViewinfoIcon;
    /**
     * Whether to show download controls for the active rendering.
     */
    showDownload?: boolean;
    /**
     * Optional download button/link label.
     */
    downloadLabel?: string;
    /**
     * Href for `UNENCRYPTED_DOWNLOAD` and `EXPORT`.
     */
    downloadHref?: string;
    /**
     * Extra CSS classe for host-level styling.
     */
    className?: string;
}

export interface MFileBodyViewActions {
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
export type MFileBodyViewModel = ViewModel<MFileBodyViewSnapshot> & MFileBodyViewActions;

interface MFileBodyViewProps {
    /**
     * The view model for the component.
     */
    vm: MFileBodyViewModel;

    /**
     * Optional iframe ref for encrypted download flow.
     */
    refIFrame?: React.RefObject<HTMLIFrameElement>;

    /**
     * Optional hidden anchor ref used to mirror download button styling.
     */
    refIFrameLink?: React.RefObject<HTMLAnchorElement>;
}

export function MFileBodyView({ vm, refIFrame, refIFrameLink }: Readonly<MFileBodyViewProps>): JSX.Element {
    const { translate: _t } = useI18n();
    const {
        rendering,
        filename,
        showInfo,
        infoTooltip,
        infoIcon,
        showDownload,
        downloadLabel,
        downloadHref,
        className,
    } = useViewModel(vm);

    const resolvedDownloadLabel = downloadLabel ?? _t("action|download");
    const resolvedInfoTooltip = infoTooltip ?? filename;

    let icon = <AttachmentIcon />;
    if (infoIcon === MFileBodyViewinfoIcon.AUDIO) {
        icon = <VolumeOnSolidIcon />;
    } else if (infoIcon === MFileBodyViewinfoIcon.VIDEO) {
        icon = <VideoCallSolidIcon />;
    }

    const info = showInfo ? (
        <button className={styles.info} onClick={vm.onInfoClick} type="button">
            <span className={styles.info_icon}>{icon}</span>
            <Tooltip description={resolvedInfoTooltip} placement="right">
                <span className={styles.info_label}>{filename}</span>
            </Tooltip>
        </button>
    ) : null;

    const classes = classNames(styles.content, className);

    switch (rendering) {
        case MFileBodyViewRendering.EXPORT:
            return (
                <span className={classes}>
                    <a href={downloadHref}>{info}</a>
                </span>
            );

        case MFileBodyViewRendering.ENCRYPTED_PENDING:
            return (
                <span className={classes}>
                    {info}
                    {showDownload && (
                        <div className={styles.download}>
                            {/* Decrypt/download is triggered by the view model action, not by an anchor `href`. */}
                            <Button size="sm" kind="secondary" Icon={DownloadIcon} onClick={vm.onDownloadClick}>
                                {resolvedDownloadLabel}
                            </Button>
                        </div>
                    )}
                </span>
            );

        case MFileBodyViewRendering.ENCRYPTED_IFRAME_DOWNLOAD:
            return (
                <span className={classes}>
                    {info}
                    {showDownload && (
                        <div className={styles.download}>
                            <div aria-hidden style={{ display: "none" }}>
                                {/*
                                 * Add dummy copy of the button
                                 * We'll use it to learn how the download button
                                 * would have been styled if it was rendered inline.
                                 */}
                                {/* this violates multiple eslint rules
                            so ignore it completely */}
                                <Button size="sm" kind="secondary" Icon={DownloadIcon} as="a" ref={refIFrameLink} />
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
                                title={resolvedDownloadLabel}
                                src="usercontent/"
                                onLoad={vm.onDownloadIframeLoad}
                                ref={refIFrame}
                                sandbox="allow-scripts allow-downloads"
                            />
                        </div>
                    )}
                </span>
            );

        case MFileBodyViewRendering.UNENCRYPTED_DOWNLOAD:
            return (
                <span className={classes}>
                    {info}
                    {showDownload && (
                        <div className={styles.download}>
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

        case MFileBodyViewRendering.INVALID:
        default:
            return (
                <span className={classes}>
                    {info}
                    <span className={styles.invalid}>{_t("timeline|m.file|error_invalid")}</span>
                </span>
            );
    }
}
