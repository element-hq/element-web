/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type MouseEventHandler, type JSX, useCallback } from "react";
import { Tooltip, Text, Avatar, Button } from "@vector-im/compound-web";
import PlaySolidIcon from "@vector-im/compound-design-tokens/assets/web/icons/play-solid";
import classNames from "classnames";

import { useI18n } from "../../../../../core/i18n/i18nContext";
import type { UrlPreview } from "../types";
import { LinkedText } from "../../../../../core/utils/LinkedText";
import styles from "./LinkPreview.module.css";

export interface LinkPreviewActions {
    onImageClick: () => void;
}

export type LinkPreviewProps = UrlPreview & LinkPreviewActions;

function LinkTitle({
    title,
    showTooltipOnLink,
    link,
}: Pick<LinkPreviewProps, "title" | "showTooltipOnLink" | "link">): JSX.Element {
    const caption = new URL(link).toString();
    const anchor = (
        <Text
            as="a"
            type="body"
            weight="semibold"
            size="lg"
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

function LinkSiteName({ siteIcon, siteName }: { siteIcon?: string; siteName: string }): JSX.Element {
    return (
        <div className={styles.siteName}>
            <Avatar size="16px" name={siteName} id={siteName} src={siteIcon} />
            <Text as="span" size="sm" weight="regular">
                {siteName}
            </Text>
        </div>
    );
}

/**
 * A condensed link preview that only contains the site icon, the title of the link and the site name.
 */
function LinkPreviewInline({
    title,
    showTooltipOnLink,
    siteIcon,
    siteName,
    link,
}: Omit<LinkPreviewProps, "image" | "description" | "author" | "onImageClick">): JSX.Element {
    return (
        <div className={classNames(styles.container, styles.inline)}>
            <div className={styles.siteAvatar}>
                <Avatar type="square" size="48px" name={title} id={title} src={siteIcon} />
            </div>
            <div className={classNames(styles.textContent, styles.inline)}>
                <LinkTitle title={title} showTooltipOnLink={showTooltipOnLink} link={link} />
                {siteName && <LinkSiteName siteName={siteName} siteIcon={siteIcon} />}
            </div>
        </div>
    );
}

/**
 * LinkPreview renders a single preview component for a single link on an event. It is usually rendered as part of
 * a `UrlPreviewGroupView`.
 */
export function LinkPreview({ onImageClick, ...preview }: LinkPreviewProps): JSX.Element {
    const { translate: _t } = useI18n();

    const onImageClickHandler = useCallback<MouseEventHandler>(
        (ev) => {
            if (ev.button != 0 || ev.metaKey) return;
            ev.preventDefault();

            if (!preview.image?.imageFull) {
                return;
            }
            onImageClick();
        },
        [preview.image?.imageFull, onImageClick],
    );

    if (!preview.image && !preview.author && !preview.description) {
        return <LinkPreviewInline {...preview} />;
    }

    let img: JSX.Element | undefined;

    if (preview.image) {
        if (preview.image.playable) {
            // Playable media do not have clickable images so we don't
            // overlay buttons atop buttons, instead we render a
            // button for them to open the media.
            img = (
                <div
                    style={{
                        backgroundImage: `url('${preview.image.imageThumb}')`,
                    }}
                    className={styles.preview}
                >
                    <Button
                        as="a"
                        href={preview.link}
                        aria-label={_t("timeline|url_preview|open_link")}
                        className={styles.playButton}
                        target="_blank"
                        rel="noreferrer noopener"
                        kind="primary"
                    >
                        <PlaySolidIcon width="24px" height="24px" />
                    </Button>
                </div>
            );
        } else {
            // Otherwise, the preview can be clicked on.
            img = (
                <button
                    className={styles.preview}
                    onClick={onImageClickHandler}
                    aria-label={_t("timeline|url_preview|view_image")}
                >
                    <img src={preview.image.imageThumb} alt={preview.image.alt} title={preview.image.alt} />
                </button>
            );
        }
    }

    return (
        <div className={styles.container}>
            {img}
            <div className={styles.textContent}>
                {preview.author && (
                    <Text as="span" size="md" weight="semibold">
                        {preview.author}
                    </Text>
                )}
                <LinkTitle title={preview.title} showTooltipOnLink={preview.showTooltipOnLink} link={preview.link} />
                <LinkedText type="body" size="md" className={styles.description}>
                    {preview.description}
                </LinkedText>
                {preview.siteName && <LinkSiteName siteName={preview.siteName} siteIcon={preview.siteIcon} />}
            </div>
        </div>
    );
}
