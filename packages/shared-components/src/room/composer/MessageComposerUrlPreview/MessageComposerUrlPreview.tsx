/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX } from "react";
import { Text } from "@vector-im/compound-web";
import classNames from "classnames";

import { type UrlPreview } from "../../timeline/event-tile/UrlPreviewGroupView";
import styles from "./MessageComposerUrlPreview.module.css";
import { LinkSiteName, LinkTitle } from "../../timeline/event-tile/UrlPreviewGroupView/LinkPreview/LinkPreview";
import { useViewModel, type ViewModel } from "../../../core/viewmodel";

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

/**
 * MessageComposerUrlPreviewView renders a preview of all previewable URLs above the messasge composer.
 */
export function MessageComposerUrlPreviewView({ vm, className }: MessageComposerUrlPreviewProps): JSX.Element | null {
    const { entries } = useViewModel(vm);
    if (entries.length === 0) {
        return null;
    }

    // Show only the first preview to revert back to previous behaviour
    // But have previews fetch all URL previews in the message text
    const previewViews = entries
        .filter((entry) => entry.include)
        .map((entry) => {
            switch (entry.status) {
                case "loaded":
                    return <div key={entry.preview.link} className={classNames(className, styles.container)}>
                        <div>
                            {entry.preview?.image?.imageThumb && (
                                <img className={styles.image} src={entry.preview.image?.imageThumb} alt={entry.preview.image.alt} />
                            )}
                            <div className={styles.text}>
                                <LinkSiteName {...entry.preview} />
                                <LinkTitle {...entry.preview} />
                                <Text className={styles.description}>{entry.preview?.description}</Text>
                            </div>
                        </div>
                    </div>;
                case "loading":
                    return <div key={entry.matched_url} className={classNames(className, styles.container)}>
                        <div>
                            <div className={styles.text}>
                                <LinkSiteName siteName={new URL(entry.matched_url).hostname} />
                                <LinkTitle title="Loading..." showTooltipOnLink={false} link={entry.matched_url} />
                                <Text className={styles.description}>{"Loading..."}</Text>
                            </div>
                        </div>
                    </div>;
                case "failed":
                    return <div key={entry.matched_url} className={classNames(className, styles.container)}>
                        <div>
                            <div className={styles.text}>
                                <LinkSiteName siteName={new URL(entry.matched_url).hostname} />
                                <LinkTitle title="Failed" showTooltipOnLink={false} link={entry.matched_url} />
                                <Text className={styles.description}>{"Failed"}</Text>
                            </div>
                        </div>
                    </div>;
            }
        });

    return <>{previewViews}</>;
}
