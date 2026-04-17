/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type ComponentType, type JSX, type MouseEventHandler } from "react";
import { Toast } from "@vector-im/compound-web";
import CheckIcon from "@vector-im/compound-design-tokens/assets/web/icons/check";

import styles from "./RoomListToast.module.css";
import { useI18n } from "../../../core/i18n/i18nContext";

export type ToastType = "section_created";

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

    let content: { text: string; icon: ComponentType<React.SVGAttributes<SVGElement>> };
    switch (type) {
        case "section_created":
            content = { text: _t("room_list|section_created"), icon: CheckIcon };
            break;
    }

    return (
        <Toast className={styles.toast} Icon={content.icon} onClose={onClose} tooltip={_t("action|close")}>
            {content.text}
        </Toast>
    );
}
