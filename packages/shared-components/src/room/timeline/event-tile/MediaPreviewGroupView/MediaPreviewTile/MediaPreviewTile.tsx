/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import React, { type JSX } from "react";
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

export interface MediaPreviewTileProps extends MediaPreviewGroupEntryBase {
    children?: JSX.Element;
}

export function MediaPreviewTile(props: MediaPreviewTileProps): JSX.Element {
    return (
        <div className={classNames(styles.tile, props.children ? styles.tileWithAbove : styles.tileWithoutAbove)}>
            {props.children}
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
    return (
        <MediaPreviewTile {...props}>
            <Image {...props} />
        </MediaPreviewTile>
    );
}

export function VideoPreviewTile(props: MediaPreviewGroupVideoEntry): JSX.Element {
    return (
        <MediaPreviewTile {...props}>
            <Video {...props} />
        </MediaPreviewTile>
    );
}

export function AudioPreviewTile(props: MediaPreviewGroupAudioEntry): JSX.Element {
    return (
        <MediaPreviewTile {...props}>
            <Audio {...props} />
        </MediaPreviewTile>
    );
}

export function TextPreviewTile(props: MediaPreviewGroupTextEntry): JSX.Element {
    return <MediaPreviewTile {...props} />;
}
