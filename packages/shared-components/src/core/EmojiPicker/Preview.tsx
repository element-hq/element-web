/*
 * Copyright 2026 Element Creations Ltd.
 * Copyright 2020 The Matrix.org Foundation C.I.C.
 * Copyright 2019 Tulir Asokan <tulir@maunium.net>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React from "react";
import { type Emoji } from "@matrix-org/emojibase-bindings";
import classNames from "classnames";

import styles from "./EmojiPicker.module.css";

interface IProps {
    emoji: Emoji;
}

class Preview extends React.PureComponent<IProps> {
    public render(): React.ReactNode {
        const {
            unicode,
            label,
            shortcodes: [shortcode],
        } = this.props.emoji;

        return (
            <div className={styles.footer}>
                <div className={styles.previewEmoji}>{unicode}</div>
                <div className={styles.previewText}>
                    <div className={classNames(styles.name, styles.previewName)}>{label}</div>
                    <div className={styles.shortcode}>{shortcode}</div>
                </div>
            </div>
        );
    }
}

export default Preview;
