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

/**
 * - full: show full image contained in tile
 * - banner: show image covering tile, height 100px
 * - tallbanner: show image covering tile, height 300px
 */
export type ImageSize = "full" | "banner" | "tallbanner";

export type MediaPreviewGroupEntryImageContent = {
    style: "image";
    /**
     * url of the image
     */
    image: string;
    /**
     * optional: what happens when the image is clicked
     */
    imageOnClick?: () => void;
    /**
     * height of the image
     */
    imageSize: ImageSize;
};

export type MediaPreviewGroupEntryVideoContent = {
    style: "video";
    /**
     * url of the video
     */
    video: string;
    /**
     * optional: what happens when the video is clicked
     */
    videoOnClick?: () => void;
    /**
     * height of the video
     */
    videoSize: ImageSize;
};

export type MediaPreviewGroupEntryAudioContent = {
    style: "audio";
    /**
     * url of the audio
     */
    audio: string;
    /**
     * optional: what happens when the audio is clicked
     */
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
    /**
     * left icon of the tile
     */
    icon: JSX.Element;
    /**
     * what happens when the icon is clicked
     */
    onClick?: () => void;
    /**
     * fill colour of the icon
     */
    color: string;
}

export type MediaPreviewGroupEntryBase = {
    /**
     * Identifies the entry within its group, used as the React key. Must be stable across renders
     * and unique within the group: the previewed link for URL previews, the event ID for attachments.
     */
    id: string;
    /**
     * header content
     */
    header: string;
    /**
     * optional: header link url
     */
    headerUrl?: string;
    /**
     * body content
     */
    body: string;

    /**
     * buttons to add to the right of the tile
     */
    buttons?: MediaPreviewEntryButton[];
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

export interface MediaPreviewGroupCollapse {
    /** Whether the group is currently collapsed, i.e. only showing a subset of the entries. */
    collapsed: boolean;
    /** How many further entries are available while collapsed. */
    hiddenCount: number;
    /** Invoked when the user toggles between the collapsed and expanded state. */
    onToggle: () => void;
}

export interface MediaPreviewGroupSnapshot {
    /**
     * tiles in the media preview group
     */
    entries: Array<MediaPreviewGroupEntry>;
    /**
     * collapse settings for the VM
     * omit is not collapsible
     */
    collapse?: MediaPreviewGroupCollapse;
}

export type MediaPreviewGroupViewModel = ViewModel<MediaPreviewGroupSnapshot>;

export interface MediaPreviewGroupPreviewProps {
    vm: MediaPreviewGroupViewModel;
}

function CollapseToggle({ collapsed, hiddenCount, onToggle }: MediaPreviewGroupCollapse): JSX.Element {
    const { translate: _t } = useI18n();

    return (
        <Button className={styles.toggleButton} kind="tertiary" size="md" onClick={onToggle}>
            {collapsed ? _t("timeline|url_preview|show_n_more", { count: hiddenCount }) : _t("action|collapse")}
        </Button>
    );
}

export function MediaPreviewGroupPreview({ vm }: MediaPreviewGroupPreviewProps): JSX.Element | null {
    const { entries, collapse } = useViewModel(vm);

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
