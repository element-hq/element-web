import React, { JSX } from "react";
import { MediaPreviewGroupAudioEntry } from "../MediaPreviewGroupView";
import styles from "./AudioPreviewTile.module.css";
import { Audio, Buttons, Icon, LeftGroup, TextContent } from "../MediaPreviewComponents/MediaPreviewComponents";

export function AudioPreviewTile(props: MediaPreviewGroupAudioEntry): JSX.Element {
    return (
        <div className={styles.tile}>
            <Audio {...props} />
            <div className={styles.bottom}>
                <LeftGroup>
                    <Icon {...props} />
                    <TextContent {...props} />
                </LeftGroup>
                {props.buttons && props.buttons.length !== 0 && <Buttons buttons={props.buttons} />}
            </div>
        </div>
    );
}
