/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX } from "react";
import classNames from "classnames";

import { type UrlPreview } from "../../timeline/event-tile/UrlPreviewGroupView";
import styles from "./MessageComposerUrlPreview.module.css";
import { LinkSiteName, LinkTitle } from "../../timeline/event-tile/UrlPreviewGroupView/LinkPreview/LinkPreview";
import { useViewModel, type ViewModel } from "../../../core/viewmodel";
import { InlineSpinner } from "@vector-im/compound-web";
import ErrorIcon from "@vector-im/compound-design-tokens/assets/web/icons/error-solid";

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
    include: boolean;
    matched_url: string;
};

/** Snapshot data for rendering a URL preview attached to the composer. */
export interface MessageComposerUrlPreviewSnapshot {
    /** URL preview to render. */
    entries: MessageComposerUrlPreviewSnapshotEntry[];
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

function hashCode(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = (Math.imul(31, hash) + str.charCodeAt(i)) | 0;
    }
    return hash;
}

function urlFirstChar(url: string): string {
    return (url.split("://")[1] ?? "?").slice(0, 1).toUpperCase()
}

/**
 * MessageComposerUrlPreviewView renders a preview of all previewable URLs above the messasge composer.
 */
export function MessageComposerUrlPreviewView({ vm, className }: MessageComposerUrlPreviewProps): JSX.Element | null {
    const { entries } = useViewModel(vm);
    if (entries.length === 0) {
        return null;
    }


    const links = entries.filter(entry => entry.include);

    // Show only the first preview to revert back to previous behaviour
    // But have previews fetch all URL previews in the message text
    const previewViews = links
        .map((entry) => {
            const hostName = new URL(entry.matched_url).hostname;
            switch (entry.status) {
                case "loaded":
                    return <div key={entry.preview.link} className={classNames(className, styles.container)}>
                        <div>
                            <div className={styles.entryIcon} style={{ backgroundColor: `hsl(${hashCode(hostName)}, 100%, var(--icon-lightness))` }}>
                                {(entry.preview?.image?.imageThumb && (
                                    <img src={entry.preview.image?.imageThumb} alt={entry.preview.image.alt} />
                                )) || urlFirstChar(entry.matched_url)}
                            </div>
                            <div className={styles.text}>
                                <LinkTitle {...entry.preview} />
                                <LinkSiteName siteName={hostName} />
                            </div>
                        </div>
                    </div>;
                case "loading":
                    return <div key={entry.matched_url} className={classNames(className, styles.container)}>
                        <div>
                            <div className={styles.loadingSpinner}>
                                <InlineSpinner />
                            </div>
                            <div className={styles.text}>
                                <LinkTitle title="Loading..." showTooltipOnLink={false} link={entry.matched_url} />
                                <LinkSiteName siteName={hostName} />
                            </div>
                        </div>
                    </div>;
                case "failed":
                    return <div key={entry.matched_url} className={classNames(className, styles.container)}>
                        <div>
                            <div className={styles.failedIcon}>
                                <ErrorIcon />
                            </div>
                            <div className={styles.text}>
                                <LinkTitle title="Failed" showTooltipOnLink={false} link={entry.matched_url} />
                                <LinkSiteName siteName={hostName} />
                            </div>
                        </div>
                    </div>;
            }
        });

    const summary = <div className={styles.summary}>
        <span className={styles.left}>
            <span className={styles.icons}>
                {links.map(entry => {
                    switch (entry.status) {
                        case "failed":
                            return <div className={styles.summaryIcon} style={{ backgroundColor: "var(--cpd-color-bg-critical-primary)" }}><ErrorIcon /></div>
                        case "loading":
                            return <div className={styles.summaryIcon} style={{ backgroundColor: "var(--cpd-color-bg-subtle-primary)" }}><InlineSpinner /></div>
                        case "loaded":
                            const siteName = new URL(entry.matched_url).hostname;
                            if (entry.preview.image !== undefined) {
                                return <div className={styles.summaryIcon}><img src={entry.preview.siteIcon || entry.preview.image.imageThumb} /></div>
                            } else {
                                return <div className={styles.summaryIcon} style={{ backgroundColor: `hsl(${hashCode(siteName)}, 100%, var(--icon-lightness))` }}>{urlFirstChar(entry.matched_url)}</div>
                            }
                    }
                })
                }
            </span>
            <span className={styles.linkCount}>{links.length} link{links.length <= 1 ? "" : "s"}</span>
        </span>
        <span className={styles.right}>
            <span className={styles.clearAll}>Clear all</span>
            <span className={styles.collapse}>›</span>
        </span>
    </div>;

    return <div className={styles.wrapper}>
        {summary}
        {previewViews}
    </div>;
}
