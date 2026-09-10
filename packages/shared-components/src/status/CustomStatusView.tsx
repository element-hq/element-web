/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX, useCallback, useState } from "react";
import { Field, Link, Menu, Root, TextControl } from "@vector-im/compound-web";

import { _t, type UserStatus } from "..";
import { EmojiPicker } from "../core/EmojiPicker";
import styles from "./CustomStatusView.module.css";
import classNames from "classnames";

/**
 * The emoji shown on the picker trigger before the user has chosen one.
 */
const DEFAULT_EMOJI = "😄";

export interface CustomStatusViewProps {
    /**
     * Called when the user commits a custom status, i.e. clicks "Save" with
     * non-empty text.
     */
    onSave: (status: UserStatus) => void;
    /**
     * Called when the user dismisses the editor without saving, i.e. clicks
     * "Cancel" while the text is empty.
     */
    onCancel: () => void;
    /**
     * Recently used emoji (unicode strings, most relevant first) to show in the
     * picker's "Frequently Used" category. The category is hidden when empty or
     * omitted.
     */
    recentEmojis?: string[];
    /**
     * Called with the chosen emoji unicode when it should be recorded as
     * recently used.
     */
    onRecordRecentEmoji?: (unicode: string) => void;
}

/**
 * Editor for composing a custom user status text and choosing an emoji.
 */
export function CustomStatusView({
    onSave,
    onCancel,
    recentEmojis,
    onRecordRecentEmoji,
}: CustomStatusViewProps): JSX.Element {
    const [emoji, setEmoji] = useState(DEFAULT_EMOJI);
    const [text, setText] = useState("");
    const [pickerOpen, setPickerOpen] = useState(false);

    const trimmed = text.trim();

    const onChooseEmoji = useCallback((unicode: string): boolean => {
        setEmoji(unicode);
        setPickerOpen(false);
        return true;
    }, []);

    const commit = useCallback(() => {
        if (trimmed) {
            onSave({ emoji, text: trimmed });
        } else {
            onCancel();
        }
    }, [trimmed, emoji, onSave, onCancel]);

    const onActionKeyDown = useCallback(
        (ev: React.KeyboardEvent<HTMLAnchorElement>) => {
            if (ev.key === "Enter" || ev.key === " ") {
                ev.preventDefault();
                commit();
            }
        },
        [commit],
    );

    const onSubmit = useCallback(
        (ev: React.FormEvent<HTMLFormElement>) => {
            ev.preventDefault();
            // Only commit on submit (e.g. Enter) when there is something to save;
            // an empty submit shouldn't silently cancel the editor.
            if (trimmed) {
                onSave({ emoji, text: trimmed });
            }
        },
        [trimmed, emoji, onSave],
    );

    return (
        <Root className={styles.customStatus} onSubmit={onSubmit}>
            <Menu
                open={pickerOpen}
                onOpenChange={setPickerOpen}
                title={_t("status|set_status|choose_emoji")}
                showTitle={false}
                align="start"
                className={styles.pickerMenu}
                trigger={
                    <button
                        type="button"
                        className={classNames(styles.emojiButton, { [styles.selected]: pickerOpen })}
                        aria-label={_t("status|set_status|choose_emoji")}
                    >
                        {emoji}
                    </button>
                }
            >
                <EmojiPicker
                    onChoose={onChooseEmoji}
                    recentEmojis={recentEmojis}
                    onRecordRecent={onRecordRecentEmoji}
                    onFinished={() => setPickerOpen(false)}
                    showQuickReactions={false}
                />
            </Menu>
            <Field name="custom-status" className={styles.textField}>
                <TextControl
                    value={text}
                    onChange={(ev) => setText(ev.currentTarget.value)}
                    placeholder={_t("status|set_status|set_status_prompt")}
                    aria-label={_t("status|set_status|set_status_prompt")}
                    autoFocus
                />
            </Field>
            <Link
                kind="primary"
                size="md"
                role="button"
                tabIndex={0}
                className={styles.action}
                onClick={commit}
                onKeyDown={onActionKeyDown}
            >
                {trimmed ? _t("action|save") : _t("action|cancel")}
            </Link>
        </Root>
    );
}
