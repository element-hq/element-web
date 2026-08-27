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

type IProps =
    | {
          /**
           * The emoji to preview.
           */
          emoji: Emoji;
          custom?: never;
      }
    | {
          emoji?: never;
          /**
           * The custom emote to preview, rendered as an image rather than a character.
           */
          custom: {
              url: string;
              label: string;
              shortcode: string;
              packDisplayName: string;
          };
      };

/**
 * A preview of the selected emoji, showing the emoji itself, its name, and its shortcode.
 */
export const Preview: React.FC<IProps> = ({ emoji, custom }) => {
    if (custom) {
        return (
            <div className={styles.footer}>
                <img
                    className={classNames(styles.previewEmoji, styles.previewCustomEmote)}
                    src={custom.url}
                    alt={custom.label}
                />
                <div className={styles.previewText}>
                    <div className={classNames(styles.name, styles.previewName)}>{custom.label}</div>
                    <div className={styles.shortcode}>{custom.shortcode}</div>
                    <div className={styles.packName}>{custom.packDisplayName}</div>
                </div>
            </div>
        );
    }

    const {
        unicode,
        label,
        shortcodes: [shortcode],
    } = emoji;

    return (
        <div className={styles.footer}>
            <div className={styles.previewEmoji}>{unicode}</div>
            <div className={styles.previewText}>
                <div className={classNames(styles.name, styles.previewName)}>{label}</div>
                <div className={styles.shortcode}>{shortcode}</div>
            </div>
        </div>
    );
};
