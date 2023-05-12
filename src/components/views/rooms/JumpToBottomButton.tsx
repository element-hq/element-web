/*
Copyright 2019 New Vector Ltd

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import React from "react";
import classNames from "classnames";

import { _t } from "../../../languageHandler";
import AccessibleButton, { ButtonEvent } from "../elements/AccessibleButton";

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
                title={_t("Scroll to most recent messages")}
                onClick={props.onScrollToBottomClick}
            />
            {badge}
        </div>
    );
};

export default JumpToBottomButton;
