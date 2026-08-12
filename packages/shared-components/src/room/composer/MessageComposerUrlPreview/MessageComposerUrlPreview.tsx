/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX } from "react";
import { Avatar, Text, Tooltip } from "@vector-im/compound-web";
import classNames from "classnames";

import { type UrlPreview } from "../../urlPreview";
import styles from "./MessageComposerUrlPreview.module.css";
import { useViewModel, type ViewModel } from "../../../core/viewmodel";

function LinkTitle({
    title,
    showTooltipOnLink,
    link,
}: Pick<UrlPreview, "title" | "showTooltipOnLink" | "link">): JSX.Element {
    const caption = new URL(link).toString();
    const anchor = (
        <Text
            as="a"
            type="body"
            weight="semibold"
            size="md"
            className={styles.title}
            href={link}
            target="_blank"
            rel="noreferrer noopener"
        >
            {title}
        </Text>
    );
    return showTooltipOnLink ? <Tooltip label={caption}>{anchor}</Tooltip> : anchor;
}

function LinkSiteName({ siteIcon, siteName }: Pick<UrlPreview, "siteIcon" | "siteName">): JSX.Element {
    return (
        <div className={styles.siteName}>
            {siteIcon && <Avatar size="16px" name={siteName} id={siteName} src={siteIcon} />}
            <Text as="span" size="sm" weight="regular">
                {siteName}
            </Text>
        </div>
    );
}

/** Snapshot data for rendering a URL preview attached to the composer. */
export interface MessageComposerUrlPreviewSnapshot {
    /** URL preview to render. */
    previews: UrlPreview[];
    /** Content of the composer when the snapshot is computed */
    content: string;
}

/** Props for MessageComposerUrlPreviewView. */
export interface MessageComposerUrlPreviewProps {
    /**
     * The view model for the component.
     */
    vm: ViewModel<MessageComposerUrlPreviewSnapshot>;
    /**
     * Extra CSS classes to apply to the component.
     */
    className?: string;
}

/**
 * MessageComposerUrlPreviewView renders a preview of all previewable URLs above the messasge composer.
 */
export function MessageComposerUrlPreviewView({ vm, className }: MessageComposerUrlPreviewProps): JSX.Element | null {
    const { previews } = useViewModel(vm);
    if (previews.length === 0) {
        return null;
    }

    // Show only the first preview to revert back to previous behaviour
    // But have previews fetch all URL previews in the message text
    const previewViews = previews.slice(0, 1).map((preview) => (
        <div key={preview.link} className={classNames(className, styles.container)}>
            <div>
                {preview?.image?.imageThumb && (
                    <img className={styles.image} src={preview.image?.imageThumb} alt={preview.image.alt} />
                )}
                <div className={styles.text}>
                    <LinkSiteName {...preview} />
                    <LinkTitle {...preview} />
                    <Text className={styles.description}>{preview?.description}</Text>
                </div>
            </div>
        </div>
    ));

    return <>{previewViews}</>;
}
