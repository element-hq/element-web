import React, { JSX } from "react";
import { MediaPreviewGroupEntry } from "../MediaPreviewGroupView";
import { Buttons, Icon, LeftGroup, TextContent } from "../MediaPreviewComponents/MediaPreviewComponents";
import styles from "./CollapsedPreviewTile.module.css"

export function CollapsedPreviewTile(props: MediaPreviewGroupEntry & { style: "collapsed" }): JSX.Element {
    return <div className={styles.tile}>
        <LeftGroup>
            <Icon {...props} />
            <TextContent {...props} />
        </LeftGroup>
        <Buttons {...props} />
    </div>;
}
