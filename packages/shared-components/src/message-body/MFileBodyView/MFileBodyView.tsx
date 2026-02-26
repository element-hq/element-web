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
    INFO = "INFO",
    DOWNLOAD_UNENCRYPTED = "DOWNLOAD_UNENCRYPTED",
    DOWNLOAD_ENCRYPTED_PENDING = "DOWNLOAD_ENCRYPTED_PENDING",
    DOWNLOAD_ENCRYPTED_IFRAME = "DOWNLOAD_ENCRYPTED_IFRAME",
    EXPORT = "EXPORT",
    INVALID = "INVALID",
}

/**
 * Which info icon to render.
 */
export enum MFileBodyViewInfoIcon {
    ATTACHMENT = "ATTACHMENT",
    AUDIO = "AUDIO",
    VIDEO = "VIDEO",
}

/**
 * @deprecated Use `MFileBodyViewInfoIcon`.
 */
export const MFileBodyViewinfoIcon = MFileBodyViewInfoIcon;

export interface MFileBodyViewSnapshot {
    /**
     * Rendering branch for the component.
     */
    rendering: MFileBodyViewRendering;
    /**
     * Visible info label (normally the file name).
     */
    infoLabel?: string;
    /**
     * Optional tooltip text for the info.
     */
    infoTooltip?: string;
    /**
     * info icon variant.
     */
    infoIcon?: MFileBodyViewInfoIcon;
    /**
     * Optional download button/link label.
     */
    downloadLabel?: string;
    /**
     * Url used for `DOWNLOAD_UNENCRYPTED` and `EXPORT`.
     */
    fileUrl?: string;
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
    const { rendering, infoLabel, infoTooltip, infoIcon, downloadLabel, fileUrl, className } = useViewModel(vm);

    const resolvedDownloadLabel = downloadLabel ?? _t("action|download");
    const resolvedInfoLabel = infoLabel ?? _t("common|attachment");
    const resolvedInfoTooltip = infoTooltip ?? resolvedInfoLabel;
    const showInfo =
        rendering === MFileBodyViewRendering.INFO ||
        rendering === MFileBodyViewRendering.EXPORT ||
        rendering === MFileBodyViewRendering.INVALID;
    const showDownload =
        rendering === MFileBodyViewRendering.DOWNLOAD_UNENCRYPTED ||
        rendering === MFileBodyViewRendering.DOWNLOAD_ENCRYPTED_PENDING ||
        rendering === MFileBodyViewRendering.DOWNLOAD_ENCRYPTED_IFRAME;

    let icon = <AttachmentIcon />;
    if (infoIcon === MFileBodyViewInfoIcon.AUDIO) {
        icon = <VolumeOnSolidIcon />;
    } else if (infoIcon === MFileBodyViewInfoIcon.VIDEO) {
        icon = <VideoCallSolidIcon />;
    }

    const info = showInfo ? (
        <button className={styles.info} onClick={vm.onInfoClick} type="button">
            <span className={styles.info_icon}>{icon}</span>
            <Tooltip description={resolvedInfoTooltip} placement="right">
                <span className={styles.info_label}>{resolvedInfoLabel}</span>
            </Tooltip>
        </button>
    ) : null;

    const classes = classNames(styles.content, className);

    switch (rendering) {
        case MFileBodyViewRendering.EXPORT:
            return (
                <span className={classes}>
                    <a href={fileUrl}>{info}</a>
                </span>
            );

        case MFileBodyViewRendering.INFO:
            return <span className={classes}>{info}</span>;

        case MFileBodyViewRendering.DOWNLOAD_ENCRYPTED_PENDING:
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

        case MFileBodyViewRendering.DOWNLOAD_ENCRYPTED_IFRAME:
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

        case MFileBodyViewRendering.DOWNLOAD_UNENCRYPTED:
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
                                href={fileUrl}
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
