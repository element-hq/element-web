import React, { JSX } from "react";
import { MediaPreviewGroupEntry } from "../MediaPreviewGroupView";
import styles from "./ExpandedPreviewTile.module.css";
import { Buttons, Icon, LargeImage, LeftGroup, TextContent } from "../MediaPreviewComponents/MediaPreviewComponents";

export function ExpandedPreviewTile(props: MediaPreviewGroupEntry & { style: "expanded" }): JSX.Element {
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
