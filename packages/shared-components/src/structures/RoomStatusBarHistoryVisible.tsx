/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type MouseEventHandler, type ReactElement } from "react";
import classNames from "classnames";
import { Alert, Button } from "@vector-im/compound-web";

import styles from "./RoomStatusBarHistoryVisible.module.css";
import { _t } from "../utils/i18n";

interface RoomStatusBarHistoryVisibleProps {
    /**
     * Called when the user presses the "dismiss" button.
     */
    onClose: MouseEventHandler<HTMLButtonElement>;
}

/**
 * A component to alert that history is shared to new members of the room.
 *
 * @example
 * ```tsx
 *   <RoomStatusBarHistoryVisible onClose={onCloseHandler} />
 * ```
 */
export function RoomStatusBarHistoryVisible(props: RoomStatusBarHistoryVisibleProps): ReactElement {
    return (
        <Alert
            className={styles.historyVisibility}
            type="info"
            title={_t("room|status_bar|history_visible")}
            actions={
                <>
                    <Button
                        as="a"
                        href="https://example.com"
                        target="_blank"
                        className={styles.historyVisibilityButton}
                        kind="tertiary"
                        size="sm"
                    >
                        {_t("action|learn_more")}
                    </Button>
                    <Button className={styles.historyVisibilityButton} kind="primary" size="sm" onClick={props.onClose}>
                        {_t("action|dismiss")}
                    </Button>
                </>
            }
        >
            {_t("room|status_bar|history_visible_description")}
        </Alert>
    );
}
