/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import React, { type JSX } from "react";
import { Button } from "@vector-im/compound-web";
import { useViewModel, type ViewModel } from "../../../../core/viewmodel";
import { useI18n } from "../../../../core/i18n/i18nContext";
import styles from "./MediaPreviewGroupView.module.css";
import {
    AudioPreviewTile,
    ImagePreviewTile,
    TextPreviewTile,
    VideoPreviewTile,
} from "./MediaPreviewTile/MediaPreviewTile";

export type MediaPreviewGroupEntryTextContent = {
    style: "text";
};

export type ImageSize = "full" | "banner" | "tallbanner";

export type MediaPreviewGroupEntryImageContent = {
    style: "image";
    image: string;
    imageOnClick?: () => void;
    imageSize: ImageSize;
};

export type MediaPreviewGroupEntryVideoContent = {
    style: "video";
    video: string;
    videoOnClick?: () => void;
    videoSize: ImageSize;
};

export type MediaPreviewGroupEntryAudioContent = {
    style: "audio";
    audio: string;
    audioOnClick?: () => void;
};

export type MediaPreviewGroupEntryContent =
    | MediaPreviewGroupEntryImageContent
    | MediaPreviewGroupEntryVideoContent
    | MediaPreviewGroupEntryAudioContent
    | MediaPreviewGroupEntryTextContent;

export interface MediaPreviewEntryButton {
    icon: JSX.Element;
    onClick: () => void;
    label: string;
}

export interface MediaPreviewIcon {
    icon: JSX.Element;
    color: string;
    iconOnClick?: () => void;
}

export type MediaPreviewGroupEntryBase = {
    /**
     * Identifies the entry within its group, used as the React key. Must be stable across renders
     * and unique within the group: the previewed link for URL previews, the event ID for attachments.
     */
    id: string;
    header: string;
    headerUrl?: string;
    body: string;

    buttons?: Array<MediaPreviewEntryButton>;
} & MediaPreviewIcon;

export type MediaPreviewGroupTextEntry = MediaPreviewGroupEntryBase & MediaPreviewGroupEntryTextContent;
export type MediaPreviewGroupImageEntry = MediaPreviewGroupEntryBase & MediaPreviewGroupEntryImageContent;
export type MediaPreviewGroupVideoEntry = MediaPreviewGroupEntryBase & MediaPreviewGroupEntryVideoContent;
export type MediaPreviewGroupAudioEntry = MediaPreviewGroupEntryBase & MediaPreviewGroupEntryAudioContent;

export type MediaPreviewGroupEntry =
    | MediaPreviewGroupImageEntry
    | MediaPreviewGroupVideoEntry
    | MediaPreviewGroupAudioEntry
    | MediaPreviewGroupTextEntry;

export interface MediaPreviewGroupSnapshot {
    entries: Array<MediaPreviewGroupEntry>;
}

export type MediaPreviewGroupViewModel = ViewModel<MediaPreviewGroupSnapshot>;

export interface MediaPreviewGroupCollapse {
    /** Whether the group is currently collapsed, i.e. only showing a subset of the entries. */
    collapsed: boolean;
    /** How many further entries are available while collapsed. */
    hiddenCount: number;
    /** Invoked when the user toggles between the collapsed and expanded state. */
    onToggle: () => void;
}

export interface MediaPreviewGroupPreviewProps {
    vm: MediaPreviewGroupViewModel;
    /**
     * When set, a toggle is rendered underneath the entries to collapse or expand the group.
     * Omit for groups that are never collapsible, e.g. a single attachment.
     */
    collapse?: MediaPreviewGroupCollapse;
}

function CollapseToggle({ collapsed, hiddenCount, onToggle }: MediaPreviewGroupCollapse): JSX.Element {
    const { translate: _t } = useI18n();

    return (
        <Button className={styles.toggleButton} kind="tertiary" size="md" onClick={onToggle}>
            {collapsed ? _t("timeline|url_preview|show_n_more", { count: hiddenCount }) : _t("action|collapse")}
        </Button>
    );
}

export function MediaPreviewGroupPreview({ vm, collapse }: MediaPreviewGroupPreviewProps): JSX.Element | null {
    const { entries } = useViewModel(vm);

    if (entries.length === 0) return null;

    return (
        <div className={styles.container}>
            {entries.map((entry) => {
                switch (entry.style) {
                    case "text":
                        return <TextPreviewTile key={entry.id} {...entry} />;
                    case "image":
                        return <ImagePreviewTile key={entry.id} {...entry} />;
                    case "video":
                        return <VideoPreviewTile key={entry.id} {...entry} />;
                    case "audio":
                        return <AudioPreviewTile key={entry.id} {...entry} />;
                }
            })}
            {collapse && <CollapseToggle {...collapse} />}
        </div>
    );
}
