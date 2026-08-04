/*
 * Copyright 2026 Element Creations Ltd.
 * Copyright 2020 The Matrix.org Foundation C.I.C.
 * Copyright 2019 Tulir Asokan <tulir@maunium.net>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { useCallback } from "react";
import { type Emoji as IEmoji } from "@matrix-org/emojibase-bindings";
import classNames from "classnames";

import { RovingButton, type ButtonEvent } from "./RovingButton";
import styles from "./EmojiPicker.module.css";

interface IProps {
    emoji: IEmoji;
    /**
     * Set of which emojis are already selected and should be decorated as such.
     * If specified, emoji will use a checkbox role with aria-checked set appropriately.
     */
    selectedEmojis?: Set<string>;
    /**
     * Called when the emoji is clicked.
     *
     * @param ev - The button event
     * @param emoji - The emoji that was clicked
     */
    onClick: (ev: ButtonEvent, emoji: IEmoji) => void;
    /**
     * Called when the mouse enters the emoji.
     *
     * @param emoji - The emoji that the mouse entered
     */
    onMouseEnter: (emoji: IEmoji) => void;
    /**
     * Called when the mouse leaves the emoji.
     *
     * @param emoji - The emoji that the mouse left
     */
    onMouseLeave: (emoji: IEmoji) => void;
    /**
     * If true, the emoji will be disabled and not clickable.
     */
    disabled?: boolean;
    /**
     * The id to use for the emoji button.
     */
    id?: string;
    /**
     * Optional class name to apply to the emoji button.
     */
    className?: string;
}

/**
 * A single emoji cell rendered in the emoji picker.
 */
export const Emoji = React.memo(function Emoji({
    onClick,
    onMouseEnter,
    onMouseLeave,
    emoji,
    selectedEmojis,
    disabled,
    id,
    className,
}: IProps): React.ReactNode {
    const isSelected = selectedEmojis?.has(emoji.unicode);

    const onMouseEnterWrapped = useCallback(() => onMouseEnter(emoji), [onMouseEnter, emoji]);
    const onMouseLeaveWrapped = useCallback(() => onMouseLeave(emoji), [onMouseLeave, emoji]);

    return (
        <RovingButton
            id={id}
            onClick={(ev) => onClick(ev, emoji)}
            onMouseEnter={onMouseEnterWrapped}
            onMouseLeave={onMouseLeaveWrapped}
            className={className}
            disabled={disabled || undefined}
            role={selectedEmojis ? "checkbox" : undefined}
            aria-checked={isSelected}
            focusOnMouseOver
        >
            <div className={classNames(styles.item, { [styles.itemSelected]: isSelected })}>{emoji.unicode}</div>
        </RovingButton>
    );
});
