/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { useCallback, type JSX } from "react";
import classNames from "classnames";
// note: useIdColorHash is not used as a hook here
import { IconButton, InlineSpinner, useIdColorHash as idColorHash } from "@vector-im/compound-web";
import { ErrorSolidIcon } from "@vector-im/compound-design-tokens/assets/web/icons";
import ChevronDownIcon from "@vector-im/compound-design-tokens/assets/web/icons/chevron-down";
import CloseIcon from "@vector-im/compound-design-tokens/assets/web/icons/close";

import { type UrlPreview } from "../../timeline/event-tile/UrlPreviewGroupView";
import styles from "./MessageComposerUrlPreview.module.css";
import { LinkSiteName, LinkTitle } from "../../timeline/event-tile/UrlPreviewGroupView/LinkPreview/LinkPreview";
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
     * Whether the preview is collapsed
     */
    collapsed: boolean;
    /**
     * Function to call to toggle collapsed state
     */
    toggleCollapsed: () => void;
    /**
     * Function to call to toggle collapsed state
     */
    removePreview?: (url: string) => void;
    /**
     * Extra CSS classes to apply to the component.
     */
    className?: string;
}

function hostNameFirstChar(hostName: string): string {
    return hostName.slice(0, 1).toUpperCase();
}

function useEntryContents(entry: MessageComposerUrlPreviewSnapshotEntry): {
    entryIcon: JSX.Element;
    entryTitle: string;
    showTooltipOnLink: boolean;
} {
    const { translate: _t } = useI18n();
    const hostname = new URL(entry.matched_url).hostname;

    switch (entry.status) {
        case "loaded": {
            const thumbnail = entry.preview?.image?.imageThumb !== undefined && (
                <img src={entry.preview.image?.imageThumb} alt={entry.preview.image.alt} />
            );
            return {
                entryIcon: (
                    // Sites without a thumbnail fall back to their initial on a decorative
                    // background, picked by `data-color` - see the module CSS.
                    <div className={styles.entryIcon} data-color={thumbnail ? undefined : idColorHash(hostname)}>
                        {thumbnail || hostNameFirstChar(hostname)}
                    </div>
                ),
                entryTitle: entry.preview.title,
                showTooltipOnLink: entry.preview.showTooltipOnLink,
            };
        }
        case "loading":
            return {
                entryIcon: (
                    <div className={styles.loadingSpinner}>
                        <InlineSpinner />
                    </div>
                ),
                entryTitle: _t("composer|url_preview|loading"),
                showTooltipOnLink: false,
            };

        case "failed":
            return {
                entryIcon: (
                    <div className={styles.failedIcon}>
                        <ErrorSolidIcon />
                    </div>
                ),
                entryTitle: _t("composer|url_preview|failed"),
                showTooltipOnLink: false,
            };
    }
}

function UrlPreviewExpandedEntry({
    entry,
    removePreview,
    className,
}: {
    entry: MessageComposerUrlPreviewSnapshotEntry;
    removePreview?: (url: string) => void;
    className?: string;
}): JSX.Element {
    const { translate: _t } = useI18n();
    const { entryIcon, entryTitle, showTooltipOnLink } = useEntryContents(entry);

    const onRemovePreview = useCallback((): void => {
        removePreview?.(entry.matched_url);
    }, [removePreview, entry.matched_url]);

    return (
        <div key={entry.matched_url} className={classNames(className, styles.container)}>
            <div className={styles.left}>
                {entryIcon}
                <div className={styles.text}>
                    <LinkTitle
                        title={entryTitle}
                        showTooltipOnLink={showTooltipOnLink}
                        link={entry.matched_url}
                        className={styles.linkTitle}
                    />
                    <LinkSiteName siteName={new URL(entry.matched_url).hostname} className={styles.linkSiteName} />
                </div>
            </div>
            {removePreview ? (
                <IconButton
                    onClick={onRemovePreview}
                    className={classNames(styles.removePreview, styles.spanLike)}
                    aria-label={_t("composer|url_preview|remove")}
                >
                    <CloseIcon aria-hidden={true} />
                </IconButton>
            ) : null}
        </div>
    );
}

/**
 * MessageComposerUrlPreviewView renders a preview of all previewable URLs above the messasge composer.
 */
export function MessageComposerUrlPreviewView({
    vm,
    className,
    collapsed,
    toggleCollapsed,
    removePreview,
}: MessageComposerUrlPreviewProps): JSX.Element | null {
    const { translate: _t } = useI18n();

    const { entries } = useViewModel(vm);
    const links = entries.filter((entry) => entry.include);

    const clearAll = useCallback(() => {
        links.forEach((entry) => removePreview?.(entry.matched_url));
    }, [links, removePreview]);

    if (links.length === 0) {
        return null;
    }

    // Show only the first preview to revert back to previous behaviour
    // But have previews fetch all URL previews in the message text
    const previewViews = collapsed
        ? null
        : links.map((entry) => (
              <UrlPreviewExpandedEntry
                  key={entry.matched_url}
                  entry={entry}
                  removePreview={removePreview}
                  className={className}
              />
          ));

    const summary = (
        <div className={styles.summary}>
            <span className={styles.left}>
                <span className={styles.icons}>
                    {links.map((entry) => {
                        let colorHash: number | undefined;
                        let className: string | undefined;
                        let icon: JSX.Element;
                        switch (entry.status) {
                            case "failed":
                                className = styles.summaryIconFailed;
                                icon = <ErrorSolidIcon />;
                                break;
                            case "loading":
                                className = styles.summaryIconLoading;
                                icon = <InlineSpinner />;
                                break;
                            case "loaded": {
                                const hostname = new URL(entry.matched_url).hostname;
                                if (entry.preview.image !== undefined) {
                                    icon = (
                                        <img
                                            src={entry.preview.siteIcon || entry.preview.image.imageThumb}
                                            alt={entry.preview.image.alt}
                                        />
                                    );
                                } else {
                                    icon = <>{hostNameFirstChar(hostname)}</>;
                                    colorHash = idColorHash(hostname);
                                }
                            }
                        }

                        return (
                            <div
                                key={entry.matched_url}
                                className={classNames(styles.summaryIcon, className)}
                                data-color={colorHash}
                            >
                                {icon}
                            </div>
                        );
                    })}
                </span>
                <span className={styles.linkCount}>{_t("composer|url_preview|n_links", { count: links.length })}</span>
            </span>
            <span className={styles.right}>
                {removePreview && (
                    <button className={classNames(styles.clearAll, styles.spanLike)} onClick={clearAll} type="button">
                        {_t("composer|url_preview|clear_all")}
                    </button>
                )}
                <IconButton
                    className={classNames(styles.collapse, styles.spanLike)}
                    onClick={toggleCollapsed}
                    aria-label={_t("composer|url_preview|collapse")}
                    type="button"
                >
                    <ChevronDownIcon aria-hidden={true} />
                </IconButton>
            </span>
        </div>
    );

    return (
        <div className={collapsed ? classNames(styles.wrapper, styles.collapsed) : styles.wrapper}>
            {summary}
            {previewViews}
        </div>
    );
}
