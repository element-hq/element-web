/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type ReactElement } from "react";
import { InfoIcon } from "@vector-im/compound-design-tokens/assets/web/icons";

import AccessibleButton from "../views/elements/AccessibleButton";
import { _t } from "../../languageHandler";

interface RoomStatusBarHistoryVisible {
    onClose: () => void;
}

export const RoomStatusBarHistoryVisible = (props: RoomStatusBarHistoryVisible): ReactElement => {
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
                    <AccessibleButton
                        kind="link_inline"
                        element="a"
                        href="https://examplecom"
                        rel="noreferrer noopener"
                        target="_blank"
                        onClick={() => {}}
                    >
                        {_t("action|learn_more")}
                    </AccessibleButton>
                </div>
                <div className="mx_RoomStatusBar_historyVisibilityButtonBar">
                    <AccessibleButton
                        className="mx_RoomStatusBar_historyVisibilityButton"
                        kind="primary"
                        onClick={props.onClose}
                    >
                        {_t("action|dismiss")}
                    </AccessibleButton>
                </div>
            </div>
        </div>
    );
};
