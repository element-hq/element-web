import React, { JSX } from "react";
import { MediaPreviewGroupVideoEntry } from "../MediaPreviewGroupView";
import styles from "./VideoPreviewTile.module.css";
import { Buttons, Icon, Video, LeftGroup, TextContent } from "../MediaPreviewComponents/MediaPreviewComponents";

export function VideoPreviewTile(props: MediaPreviewGroupVideoEntry): JSX.Element {
    return (
        <div className={styles.tile}>
            <Video {...props} />
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
