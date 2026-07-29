import React, { JSX } from "react";
import { useViewModel, ViewModel } from "../../../../core/viewmodel";
import styles from "./MediaPreviewGroupView.module.css";
import { CollapsedPreviewTile } from "./CollapsedPreviewTile/CollapsedPreviewTile";

export type MediaPreviewGroupEntryCollapsedContent = {
    style: "collapsed";
};

export type MediaPreviewGroupEntryExpandedContent = {
    style: "expanded";
    // footer?: string;
    largeImage: string;
    largeImageOnClick?: () => void;
};

export type MediaPreviewGroupEntryContent =
    | MediaPreviewGroupEntryExpandedContent
    | MediaPreviewGroupEntryCollapsedContent;

export interface MediaPreviewEntryButton {
    icon: JSX.Element;
    onClick: () => void;
}

export interface MediaPreviewIcon {
    icon: JSX.Element;
    color: string;
    iconOnClick?: () => void;
}

export type MediaPreviewGroupEntry = {
    header: string;
    headerUrl?: string;
    body: string;

    buttons?: Array<MediaPreviewEntryButton>;
} & MediaPreviewGroupEntryContent &
    MediaPreviewIcon;

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
                    case "collapsed":
                        return <CollapsedPreviewTile {...entry} />;
                }
            })}
        </div>
    );
}
