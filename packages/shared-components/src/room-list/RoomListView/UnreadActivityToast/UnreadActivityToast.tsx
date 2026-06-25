/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX, type MouseEventHandler } from "react";
import { Toast } from "@vector-im/compound-web";
import ArrowDownIcon from "@vector-im/compound-design-tokens/assets/web/icons/arrow-down";

import styles from "./UnreadActivityToast.module.css";
import { useI18n } from "../../../core/i18n/i18nContext";

interface UnreadActivityToastProps {
    /**
     * Called when the toast is clicked. The whole toast is a button; clicking it
     * should jump to the next unread room below the visible area of the list.
     */
    onClick: MouseEventHandler<HTMLButtonElement>;
}

/**
 * A clickable toast shown at the bottom of the room list when there is unread
 * activity in rooms scrolled below the visible area. Clicking it jumps to the
 * next unread room below the fold.
 *
 * @example
 * ```tsx
 *   <UnreadActivityToast onClick={onClickHandler} />
 * ```
 */
export function UnreadActivityToast({ onClick }: Readonly<UnreadActivityToastProps>): JSX.Element {
    const { translate: _t } = useI18n();

    return (
        <Toast className={styles.toast} Icon={ArrowDownIcon} onClick={onClick}>
            {_t("room_list|unread_messages")}
        </Toast>
    );
}
