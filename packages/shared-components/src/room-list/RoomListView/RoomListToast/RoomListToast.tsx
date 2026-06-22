/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX, type MouseEventHandler } from "react";
import { Toast } from "@vector-im/compound-web";

import styles from "./RoomListToast.module.css";
import { useI18n } from "../../../core/i18n/i18nContext";

export type ToastType = "section_created" | "chat_moved";

interface RoomListToastProps {
    /** The type of toast to display */
    type: ToastType;
    /** Callback when the close button is clicked */
    onClose: MouseEventHandler<HTMLButtonElement>;
}

/**
 * A toast component used for displaying temporary messages in the room list view.
 *
 * @example
 * ```tsx
 *   <RoomListToast type="section_created" onClose={onCloseHandler} />
 * ```
 */
export function RoomListToast({ type, onClose }: Readonly<RoomListToastProps>): JSX.Element {
    const { translate: _t } = useI18n();

    let text: string;
    switch (type) {
        case "section_created":
            text = _t("room_list|section_created");
            break;
        case "chat_moved":
            text = _t("room_list|chat_moved");
            break;
    }

    return (
        <Toast className={styles.toast} onClose={onClose} tooltip={_t("action|close")}>
            {text}
        </Toast>
    );
}
