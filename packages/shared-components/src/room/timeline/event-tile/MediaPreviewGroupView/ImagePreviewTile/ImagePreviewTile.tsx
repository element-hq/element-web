import React, { JSX } from "react";
import { MediaPreviewGroupImageEntry } from "../MediaPreviewGroupView";
import styles from "./ImagePreviewTile.module.css";
import { Buttons, Icon, LargeImage, LeftGroup, TextContent } from "../MediaPreviewComponents/MediaPreviewComponents";

export function ImagePreviewTile(props: MediaPreviewGroupImageEntry): JSX.Element {
    return (
        <div className={styles.tile}>
            <LargeImage {...props} />
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
