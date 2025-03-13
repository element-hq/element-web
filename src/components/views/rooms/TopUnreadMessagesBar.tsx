/*
Copyright 2024 New Vector Ltd.
Copyright 2016-2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";

import { _t } from "../../../languageHandler";
import AccessibleButton, { type ButtonEvent } from "../elements/AccessibleButton";

interface IProps {
    onScrollUpClick: (e: ButtonEvent) => void;
    onCloseClick: (e: ButtonEvent) => void;
}

export default class TopUnreadMessagesBar extends React.PureComponent<IProps> {
    public render(): React.ReactNode {
        return (
            <div className="mx_TopUnreadMessagesBar">
                <AccessibleButton
                    className="mx_TopUnreadMessagesBar_scrollUp"
                    title={_t("room|jump_read_marker")}
                    onClick={this.props.onScrollUpClick}
                />
                <AccessibleButton
                    className="mx_TopUnreadMessagesBar_markAsRead"
                    title={_t("notifications|mark_all_read")}
                    onClick={this.props.onCloseClick}
                />
            </div>
        );
    }
}
