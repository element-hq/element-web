import React, { JSX } from "react";
import type {
    MediaPreviewGroupAudioEntry,
    MediaPreviewGroupEntryBase,
    MediaPreviewGroupImageEntry,
    MediaPreviewGroupTextEntry,
    MediaPreviewGroupVideoEntry,
} from "../MediaPreviewGroupView";
import styles from "./MediaPreviewTile.module.css";
import {
    Audio,
    Buttons,
    Icon,
    Image,
    LeftGroup,
    TextContent,
    Video,
} from "../MediaPreviewComponents/MediaPreviewComponents";
import classNames from "classnames";

export function MediaPreviewTile(props: MediaPreviewGroupEntryBase & { above?: JSX.Element }): JSX.Element {
    return (
        <div className={classNames(styles.tile, props.above ? styles.tileWithAbove : styles.tileWithoutAbove)}>
            {props.above}
            <div className={styles.below}>
                <LeftGroup>
                    <Icon {...props} />
                    <TextContent {...props} />
                </LeftGroup>
                {props.buttons && props.buttons.length !== 0 && <Buttons buttons={props.buttons} />}
            </div>
        </div>
    );
}

export function ImagePreviewTile(props: MediaPreviewGroupImageEntry): JSX.Element {
    return <MediaPreviewTile above={<Image {...props} />} {...props} />;
}

export function VideoPreviewTile(props: MediaPreviewGroupVideoEntry): JSX.Element {
    return <MediaPreviewTile above={<Video {...props} />} {...props} />;
}

export function AudioPreviewTile(props: MediaPreviewGroupAudioEntry): JSX.Element {
    return <MediaPreviewTile above={<Audio {...props} />} {...props} />;
}

export function TextPreviewTile(props: MediaPreviewGroupTextEntry): JSX.Element {
    return <MediaPreviewTile {...props} />;
}
