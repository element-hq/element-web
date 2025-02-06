/*
Copyright 2019-2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import classNames from "classnames";

import { _t } from "../../../languageHandler";
import AccessibleButton, { type ButtonEvent } from "../elements/AccessibleButton";

interface IProps {
    numUnreadMessages?: number;
    highlight: boolean;
    onScrollToBottomClick: (e: ButtonEvent) => void;
}

const JumpToBottomButton: React.FC<IProps> = (props) => {
    const className = classNames({
        mx_JumpToBottomButton: true,
        mx_JumpToBottomButton_highlight: props.highlight,
    });
    let badge;
    if (props.numUnreadMessages) {
        badge = <div className="mx_JumpToBottomButton_badge">{props.numUnreadMessages}</div>;
    }
    return (
        <div className={className}>
            <AccessibleButton
                className="mx_JumpToBottomButton_scrollDown"
                title={_t("room|jump_to_bottom_button")}
                onClick={props.onScrollToBottomClick}
            />
            {badge}
        </div>
    );
};

export default JumpToBottomButton;
