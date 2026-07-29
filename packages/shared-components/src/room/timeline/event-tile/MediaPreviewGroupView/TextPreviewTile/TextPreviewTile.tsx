import React, { JSX } from "react";
import { MediaPreviewGroupTextEntry } from "../MediaPreviewGroupView";
import { Buttons, Icon, LeftGroup, TextContent } from "../MediaPreviewComponents/MediaPreviewComponents";
import styles from "./TextPreviewTile.module.css";

export function TextPreviewTile(props: MediaPreviewGroupTextEntry & { style: "text" }): JSX.Element {
    // todo: check collapsed
    return (
        <div className={styles.tile}>
            <LeftGroup>
                <Icon {...props} />
                <TextContent {...props} />
            </LeftGroup>
            {props.buttons && props.buttons.length !== 0 && <Buttons buttons={props.buttons} />}
        </div>
    );
}
