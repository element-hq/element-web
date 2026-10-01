/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX, type MouseEventHandler } from "react";
import { Toast } from "@vector-im/compound-web";
import ArrowDownIcon from "@vector-im/compound-design-tokens/assets/web/icons/arrow-down";

import styles from "./RoomListToast.module.css";
import { useI18n } from "../../../core/i18n/i18nContext";

export type ToastType =
    // Transient, auto-dismissing event toasts with a close button.
    | "section_created"
    | "chat_moved"
    // Persistent, clickable toast surfacing unread activity below the visible area.
    | "unread_activity";

interface RoomListToastProps {
    /** The type of toast to display */
    type: ToastType;
    /** Callback when the close button is clicked (event toasts: "section_created", "chat_moved") */
    onClose: MouseEventHandler<HTMLButtonElement>;
    /** Callback when the toast itself is clicked ("unread_activity") */
    onClick: MouseEventHandler<HTMLButtonElement>;
}

/**
 * A toast component used for displaying messages in the room list view.
 *
 * The room list shows at most one toast at a time; which one (and the precedence between
 * transient event toasts and the persistent unread-activity toast) is decided by the view
 * model, so the view simply renders whichever {@link ToastType} it is given:
 *
 * - "section_created" / "chat_moved": transient event notifications with a close button.
 * - "unread_activity": a persistent, clickable toast that jumps to the next unread room
 *   below the visible area of the list.
 *
 * @example
 * ```tsx
 *   <RoomListToast type="section_created" onClose={onCloseHandler} onClick={onClickHandler} />
 * ```
 */
export function RoomListToast({ type, onClose, onClick }: Readonly<RoomListToastProps>): JSX.Element {
    const { translate: _t } = useI18n();

    // The unread-activity toast is clickable as a whole (it scrolls to the unread room) rather
    // than closeable, so it uses the clickable Toast variant with a leading arrow-down icon.
    if (type === "unread_activity") {
        return (
            <Toast className={styles.toast} Icon={ArrowDownIcon} onClick={onClick}>
                {_t("room_list|unread_messages")}
            </Toast>
        );
    }

    const text = type === "section_created" ? _t("room_list|section_created") : _t("room_list|chat_moved");
    return (
        <Toast className={styles.toast} onClose={onClose} tooltip={_t("action|close")}>
            {text}
        </Toast>
    );
}
