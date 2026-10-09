/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import React, { type JSX } from "react";
import classNames from "classnames";
import { Button, IconButton } from "@vector-im/compound-web";
import CloseIcon from "@vector-im/compound-design-tokens/assets/web/icons/close";
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
    type: "text";
};

/**
 * - full: show full image contained in tile
 * - banner: show image covering tile, height 100px
 * - tallbanner: show image covering tile, height 300px
 * - thumbnail: show image covering a fixed 130x142px box, for the "side" layout
 * - logo: show a small image such as a site logo centred in the same 130x142px box, for the "side" layout
 */
export type ImageSize = "full" | "banner" | "tallbanner" | "thumbnail" | "logo";

/**
 * - stacked: media above icon, text and buttons (default)
 * - side: media left, text right, no icon
 */
export type MediaPreviewLayout = "stacked" | "side";

export type MediaPreviewGroupEntryImageContent = {
    type: "image";
    /**
     * url of the image
     */
    image: string;
    /**
     * alt text for image
     */
    imageAlt: string;
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
    type: "video";
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
    type: "audio";
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
     * optional: footer line below the body, e.g. a link's host
     */
    footer?: string;
    /**
     * optional: tile layout, defaults to "stacked"
     */
    layout?: MediaPreviewLayout;
    /**
     * buttons to add to the right of the tile
     */
    buttons?: MediaPreviewEntryButton[];
} & Partial<MediaPreviewIcon>;

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
    /**
     * Invoked when the user closes the group with the button at its top right.
     * Omit for a group that cannot be dismissed, such as a message's attachments.
     */
    onDismiss?: () => void;
}

export type MediaPreviewGroupViewModel = ViewModel<MediaPreviewGroupSnapshot>;

export interface MediaPreviewGroupPreviewProps {
    vm: MediaPreviewGroupViewModel;
    /**
     * Optional host-level class names applied to the group container.
     */
    className?: string;
}

function CollapseToggle({ collapsed, hiddenCount, onToggle }: MediaPreviewGroupCollapse): JSX.Element {
    const { translate: _t } = useI18n();

    return (
        <Button className={styles.toggleButton} kind="tertiary" size="md" onClick={onToggle}>
            {collapsed ? _t("timeline|url_preview|show_n_more", { count: hiddenCount }) : _t("action|collapse")}
        </Button>
    );
}

function DismissButton({ onDismiss }: { onDismiss: () => void }): JSX.Element {
    const { translate: _t } = useI18n();

    return (
        <IconButton
            className={styles.dismissButton}
            kind="secondary"
            size="28px"
            onClick={onDismiss}
            aria-label={_t("timeline|url_preview|close")}
        >
            <CloseIcon />
        </IconButton>
    );
}

export function MediaPreviewGroupPreview({ vm, className }: MediaPreviewGroupPreviewProps): JSX.Element | null {
    const { entries, collapse, onDismiss } = useViewModel(vm);

    if (entries.length === 0) return null;

    // The dismiss button comes after the tiles so that the first tile stays the container's first child,
    // which is what the stylesheet uses to keep that tile's text clear of the button.
    return (
        <div className={classNames(className, styles.container, { [styles.dismissable]: onDismiss !== undefined })}>
            {entries.map((entry) => {
                switch (entry.type) {
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
            {onDismiss && <DismissButton onDismiss={onDismiss} />}
        </div>
    );
}
