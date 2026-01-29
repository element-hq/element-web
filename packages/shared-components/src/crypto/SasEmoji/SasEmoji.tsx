/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX } from "react";
import classNames from "classnames";

import { type SasEmoji, tEmoji } from "./SasEmojiTranslate.ts";
import styles from "./SasEmoji.module.css";
import { useI18n } from "../../utils/i18nContext.ts";

export type Props = {
    /**
     * The emoji to render
     */
    emoji: [SasEmoji, SasEmoji, SasEmoji, SasEmoji, SasEmoji, SasEmoji, SasEmoji];
    /**
     * Optional className to apply to the container
     */
    className?: string;
};

/**
 * Renders the 7 emoji used for SAS verification.
 * The component is responsive so can be rendered in any context, dialog, side panel.
 */
export function SasEmoji({ emoji, className }: Props): JSX.Element {
    const { language } = useI18n();

    const emojiBlocks = emoji.map((emoji, i) => (
        <div className={styles.segment} key={i}>
            <div className={styles.emoji} aria-hidden={true}>
                {emoji}
            </div>
            <div className={styles.label}>{tEmoji(emoji, language)}</div>
        </div>
    ));

    return <div className={classNames(styles.container, className)}>{emojiBlocks}</div>;
}
