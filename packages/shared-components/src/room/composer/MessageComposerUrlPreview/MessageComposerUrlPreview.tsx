/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX, useCallback } from "react";
import { IconButton, InlineSpinner, Text, Tooltip } from "@vector-im/compound-web";
import classNames from "classnames";
import ErrorSolidIcon from "@vector-im/compound-design-tokens/assets/web/icons/error-solid";
import LinkIcon from "@vector-im/compound-design-tokens/assets/web/icons/link";
import CloseIcon from "@vector-im/compound-design-tokens/assets/web/icons/close";

import { type UrlPreview } from "shared-types";
import styles from "./MessageComposerUrlPreview.module.css";
import { useViewModel, type ViewModel } from "../../../core/viewmodel";
import { useI18n } from "../../../core/i18n/i18nContext";

export interface MessageComposerUrlPreviewSnapshotEntryLoaded {
    status: "loaded";
    preview: UrlPreview;
}

export interface MessageComposerUrlPreviewSnapshotEntryLoading {
    status: "loading";
}

export interface MessageComposerUrlPreviewSnapshotEntryFailed {
    status: "failed";
}

export type MessageComposerUrlPreviewSnapshotEntryState =
    | MessageComposerUrlPreviewSnapshotEntryFailed
    | MessageComposerUrlPreviewSnapshotEntryLoaded
    | MessageComposerUrlPreviewSnapshotEntryLoading;

/**
 * An entry in the URL preview box
 */
export type MessageComposerUrlPreviewSnapshotEntry = MessageComposerUrlPreviewSnapshotEntryState & {
    /**
     * default: true
     * set to false when the preview is removed by the user
     * so the vm remembers to not show the previews list even after another computeSnapshot
     */
    include: boolean;
    /**
     * the url string that the preview is representing
     */
    matched_url: string;
};

/** Snapshot data for rendering a URL preview attached to the composer. */
export interface MessageComposerUrlPreviewSnapshot {
    /** URL preview to render. */
    entries: MessageComposerUrlPreviewSnapshotEntry[];
    /** Content of the composer when the snapshot is computed */
    content: string;
    /** The links that are in the message body, including the ones that are removed */
    contentLinks: Set<string>;
    /** Whether the entries have been changed by removing it */
    isModified: boolean;
}

/** Props for MessageComposerUrlPreviewView. */
export interface MessageComposerUrlPreviewProps {
    /**
     * The view model for the component.
     */
    vm: ViewModel<MessageComposerUrlPreviewSnapshot>;
    /**
     * Function to call to remove the preview of a link. The remove buttons are only shown when this is set.
     */
    removePreview?: (url: string) => void;
    /**
     * Extra CSS classes to apply to the component.
     */
    className?: string;
}

/** The host of a link as shown under its title, e.g. "github.com". The link itself if it cannot be parsed. */
function linkHost(link: string): string {
    try {
        return new URL(link).hostname.toLowerCase().replace(/^www\./, "");
    } catch {
        return link;
    }
}

/**
 * The square box on the left of a preview card: the preview image, else the site logo, else a link icon.
 * Loading and failed entries show a spinner and an error icon instead.
 */
function Thumbnail({ entry }: { entry: MessageComposerUrlPreviewSnapshotEntry }): JSX.Element {
    switch (entry.status) {
        case "loading":
            return (
                <div className={styles.thumbnail}>
                    <InlineSpinner />
                </div>
            );
        case "failed":
            return (
                <div className={classNames(styles.thumbnail, styles.thumbnailFailed)}>
                    <ErrorSolidIcon aria-hidden={true} />
                </div>
            );
        case "loaded": {
            const { image, siteIcon } = entry.preview;
            if (image?.imageThumb) {
                return (
                    <div className={classNames(styles.thumbnail, styles.thumbnailImage)}>
                        <img src={image.imageThumb} alt={image.alt ?? ""} />
                    </div>
                );
            }
            if (siteIcon) {
                return (
                    <div className={classNames(styles.thumbnail, styles.thumbnailLogo)}>
                        <img src={siteIcon} alt="" />
                    </div>
                );
            }
            return (
                <div className={styles.thumbnail}>
                    <LinkIcon aria-hidden={true} />
                </div>
            );
        }
    }
}

/** A single preview card, with its remove button at the right end of the card. */
function UrlPreviewEntry({
    entry,
    removePreview,
}: {
    entry: MessageComposerUrlPreviewSnapshotEntry;
    removePreview?: (url: string) => void;
}): JSX.Element {
    const { translate: _t } = useI18n();
    const onRemovePreview = useCallback((): void => {
        removePreview?.(entry.matched_url);
    }, [removePreview, entry.matched_url]);

    let title: string;
    let showTooltipOnLink = false;
    switch (entry.status) {
        case "loaded":
            title = entry.preview.title;
            showTooltipOnLink = entry.preview.showTooltipOnLink;
            break;
        case "loading":
            title = _t("composer|url_preview|loading");
            break;
        case "failed":
            title = _t("composer|url_preview|failed");
            break;
    }

    const anchor = (
        <Text
            as="a"
            type="body"
            weight="semibold"
            size="md"
            className={styles.title}
            href={entry.matched_url}
            target="_blank"
            rel="noreferrer noopener"
        >
            {title}
        </Text>
    );

    return (
        <li className={styles.card}>
            <Thumbnail entry={entry} />
            <div className={styles.text}>
                {showTooltipOnLink ? <Tooltip label={entry.matched_url}>{anchor}</Tooltip> : anchor}
                <Text as="span" size="sm" className={styles.host}>
                    {linkHost(entry.matched_url)}
                </Text>
            </div>
            {removePreview && (
                <IconButton
                    size="28px"
                    onClick={onRemovePreview}
                    className={styles.removePreview}
                    aria-label={_t("composer|url_preview|remove")}
                >
                    <CloseIcon aria-hidden={true} />
                </IconButton>
            )}
        </li>
    );
}

/**
 * MessageComposerUrlPreviewView renders a preview card for each previewable URL above the message composer,
 * under a heading counting the links. When `removePreview` is set, each card has a remove button and the
 * heading has a button to remove them all.
 */
export function MessageComposerUrlPreviewView({
    vm,
    className,
    removePreview,
}: MessageComposerUrlPreviewProps): JSX.Element | null {
    const { translate: _t } = useI18n();
    const { entries } = useViewModel(vm);
    const links = entries.filter((entry) => entry.include);

    const clearAll = useCallback((): void => {
        links.forEach((entry) => removePreview?.(entry.matched_url));
    }, [links, removePreview]);

    if (links.length === 0) {
        return null;
    }

    return (
        <div className={classNames(styles.wrapper, className)}>
            <div className={styles.header}>
                <Text as="div" size="sm" weight="semibold" className={styles.heading}>
                    {_t("composer|url_preview|n_links", { count: links.length })}
                </Text>
                {removePreview && (
                    <Text
                        as="button"
                        type="button"
                        size="sm"
                        weight="medium"
                        className={styles.clearAll}
                        onClick={clearAll}
                    >
                        {_t("composer|url_preview|clear_all")}
                    </Text>
                )}
            </div>
            <ul className={styles.list}>
                {links.map((entry) => (
                    <UrlPreviewEntry key={entry.matched_url} entry={entry} removePreview={removePreview} />
                ))}
            </ul>
        </div>
    );
}
