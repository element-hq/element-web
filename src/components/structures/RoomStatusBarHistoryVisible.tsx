/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type ReactElement } from "react";
import { InfoIcon } from "@vector-im/compound-design-tokens/assets/web/icons";
import { Button, Link } from "@vector-im/compound-web";

import { _t } from "../../languageHandler";

interface RoomStatusBarHistoryVisibleProps {
    /**
     * Called when the user presses the "dismiss" button.
     */
    onClose: () => void;
}

/**
 * RoomStatusBarHistoryVisible component.
 *
 * @param props - Props for the RoomStatusBarHistoryVisible component. See {@link RoomStatusBarHistoryVisibleProps}.
 * @returns A ReactElement representing the status bar.
 */
export const RoomStatusBarHistoryVisible = (props: RoomStatusBarHistoryVisibleProps): ReactElement => {
    return (
        <div className="mx_RoomStatusBar mx_RoomStatusBar_historyVisibility">
            <div role="alert">
                <div className="mx_RoomStatusBar_historyVisibilityBadge">
                    <InfoIcon />
                </div>
                <div>
                    <div className="mx_RoomStatusBar_historyVisibilityDescription">
                        {_t("room|status_bar|history_visible")}
                    </div>
                    <Link kind="primary" as="a" href="https://example.com" target="_blank">
                        {_t("action|learn_more")}
                    </Link>
                </div>
                <div className="mx_RoomStatusBar_historyVisibilityButtonBar">
                    <Button kind="primary" size="sm" onClick={props.onClose}>
                        {_t("action|dismiss")}
                    </Button>
                </div>
            </div>
        </div>
    );
};
