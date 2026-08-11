import React, { JSX } from "react";
import { useViewModel, ViewModel } from "../../../../core/viewmodel";
import styles from "./MediaPreviewGroupView.module.css";
import { TextPreviewTile } from "./TextPreviewTile/TextPreviewTile";
import { AudioPreviewTile, ImagePreviewTile, VideoPreviewTile } from "./MediaPreviewTile/MediaPreviewTile";

export type MediaPreviewGroupEntryTextContent = {
    style: "text";
};

export type ImageSize = "full" | "banner";

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
}

export interface MediaPreviewIcon {
    icon: JSX.Element;
    color: string;
    iconOnClick?: () => void;
}

export type MediaPreviewGroupEntryBase = {
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

export interface MediaPreviewGroupPreviewProps {
    vm: MediaPreviewGroupViewModel;
}

export function MediaPreviewGroupPreview({ vm }: MediaPreviewGroupPreviewProps): JSX.Element | null {
    let { entries } = useViewModel(vm);

    if (entries.length === 0) return null;

    return (
        <div className={styles.container}>
            {entries.map((entry) => {
                switch (entry.style) {
                    case "text":
                        return <TextPreviewTile {...entry} />;
                    case "image":
                        return <ImagePreviewTile {...entry} />;
                    case "video":
                        return <VideoPreviewTile {...entry} />;
                    case "audio":
                        return <AudioPreviewTile {...entry} />;
                }
            })}
        </div>
    );
}
