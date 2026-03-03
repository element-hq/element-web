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
import { MediaBody } from "../MediaBody";

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
    DOWNLOAD = "DOWNLOAD",
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
     * Optional label (normally the file name). Defaults to 'Attachment' or 'Download' depending on rendering.
     */
    label?: string;
    /**
     * Optional tooltip for info button. Defaults to label.
     */
    tooltip?: string;
    /**
     * Optional icon. Defaults to `ATTACHMENT` for info/export/invalid modes and `DOWNLOAD` for download modes.
     */
    icon?: MFileBodyViewInfoIcon;
    /**
     * URL used for `DOWNLOAD_UNENCRYPTED` and `EXPORT`.
     */
    href?: string;
    /**
     * Extra CSS class for host-level styling.
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
 * - info-only display (`INFO`, `INVALID`)
 * - export link (`EXPORT`)
 * - unencrypted download link (`DOWNLOAD_UNENCRYPTED`)
 * - encrypted download states (`DOWNLOAD_ENCRYPTED_PENDING`, `DOWNLOAD_ENCRYPTED_IFRAME`)
 *
 * Labels, tooltips, and icons are resolved from snapshot values with i18n fallbacks.
 *
 * @example
 * ```tsx
 * <MFileBodyView vm={fileBodyViewModel} />
 * ```
 */
export function MFileBodyView({ vm, refIFrame, refLink }: Readonly<MFileBodyViewProps>): JSX.Element {
    const { translate: _t } = useI18n();
    const { rendering, label, tooltip, icon, href, className } = useViewModel(vm);

    const showInfo =
        rendering === MFileBodyViewRendering.INFO ||
        rendering === MFileBodyViewRendering.EXPORT ||
        rendering === MFileBodyViewRendering.INVALID;

    const resolvedLabel = label ?? (showInfo ? _t("common|attachment") : _t("action|download"));
    const resolvedInfoTooltip = tooltip ?? resolvedLabel;

    let resolvedIcon = showInfo ? AttachmentIcon : DownloadIcon;
    if (icon === MFileBodyViewInfoIcon.AUDIO) {
        resolvedIcon = VolumeOnSolidIcon;
    } else if (icon === MFileBodyViewInfoIcon.ATTACHMENT) {
        resolvedIcon = AttachmentIcon;
    } else if (icon === MFileBodyViewInfoIcon.DOWNLOAD) {
        resolvedIcon = DownloadIcon;
    } else if (icon === MFileBodyViewInfoIcon.VIDEO) {
        resolvedIcon = VideoCallSolidIcon;
    }

    const info = showInfo ? (
        <MediaBody data-type="info" onClick={vm.onInfoClick} role="button" tabIndex={0}>
            <span data-type="info-icon">{React.createElement(resolvedIcon)}</span>
            <Tooltip description={resolvedInfoTooltip} placement="right">
                <span data-type="info-label">{resolvedLabel}</span>
            </Tooltip>
        </MediaBody>
    ) : null;

    const classes = classNames(styles.content, className);

    switch (rendering) {
        case MFileBodyViewRendering.EXPORT:
            return (
                <span className={classes}>
                    <a href={href}>{info}</a>
                </span>
            );

        case MFileBodyViewRendering.INFO:
            return <span className={classes}>{info}</span>;

        case MFileBodyViewRendering.DOWNLOAD_ENCRYPTED_PENDING:
            return (
                <span className={classes}>
                    <div data-type="download">
                        {/* Decrypt/download is triggered by the view model action, not by an anchor `href`. */}
                        <Button size="sm" kind="secondary" Icon={resolvedIcon} onClick={vm.onDownloadClick}>
                            {resolvedLabel}
                        </Button>
                    </div>
                </span>
            );

        case MFileBodyViewRendering.DOWNLOAD_ENCRYPTED_IFRAME:
            return (
                <span className={classes}>
                    <div data-type="download">
                        <div aria-hidden style={{ display: "none" }}>
                            {/*
                             * Add dummy copy of the button
                             * We'll use it to learn how the download button
                             * would have been styled if it was rendered inline.
                             * this violates multiple eslint rules so ignore it completely */}
                            <Button size="sm" kind="secondary" Icon={resolvedIcon} as="a" ref={refLink} />
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
                            title={resolvedLabel}
                            src="usercontent/"
                            onLoad={vm.onDownloadIframeLoad}
                            ref={refIFrame}
                            sandbox="allow-scripts allow-downloads"
                        />
                    </div>
                </span>
            );

        case MFileBodyViewRendering.DOWNLOAD_UNENCRYPTED:
            return (
                <span className={classes}>
                    <div data-type="download">
                        {/* Unencrypted media uses an anchor element with VM-controlled click behavior. */}
                        <Button
                            size="sm"
                            kind="secondary"
                            Icon={resolvedIcon}
                            as="a"
                            href={href}
                            target="_blank"
                            rel="noreferrer noopener"
                            onClick={vm.onDownloadLinkClick}
                        >
                            {resolvedLabel}
                        </Button>
                    </div>
                </span>
            );

        case MFileBodyViewRendering.INVALID:
        default:
            return (
                <>
                    <span className={classes}>{info}</span>
                    <span className={styles.invalid}>{_t("timeline|m.file|error_invalid")}</span>
                </>
            );
    }
}
