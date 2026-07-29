import React, { JSX } from "react";
import { useViewModel, ViewModel } from "../../../../core/viewmodel";
import styles from "./MediaPreviewGroupView.module.css";
import { TextPreviewTile } from "./TextPreviewTile/TextPreviewTile";

export type MediaPreviewGroupEntryTextContent = {
    style: "textonly";
};

export type ImageSize = "full" | "banner";

export type MediaPreviewGroupEntryImageContent = {
    style: "image";
    // footer?: string;
    largeImage: string;
    largeImageOnClick?: () => void;
    imageSize: ImageSize;
};

export type MediaPreviewGroupEntryContent =
    | MediaPreviewGroupEntryImageContent
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

export type MediaPreviewGroupEntry = MediaPreviewGroupImageEntry | MediaPreviewGroupTextEntry;

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
                    case "textonly":
                        return <TextPreviewTile {...entry} />;
                }
            })}
        </div>
    );
}
