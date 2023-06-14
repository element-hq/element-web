/*
Copyright 2015, 2016 OpenMarket Ltd
Copyright 2017 Vector Creations Ltd
Copyright 2017 New Vector Ltd
Copyright 2018 New Vector Ltd
Copyright 2019 The Matrix.org Foundation C.I.C.

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

import React, { ReactNode } from "react";
import classNames from "classnames";

import AccessibleTooltipButton from "../elements/AccessibleTooltipButton";
import { ButtonEvent } from "../elements/AccessibleButton";
import { Alignment } from "../elements/Tooltip";

interface IProps {
    // Whether this button is highlighted
    isHighlighted: boolean;
    isUnread?: boolean;
    // click handler
    onClick: (ev: ButtonEvent) => void;

    // Button name
    name: string;
    // Button title
    title: string;
    children?: ReactNode;
}

// TODO: replace this, the composer buttons and the right panel buttons with a unified representation
export default class HeaderButton extends React.Component<IProps> {
    public render(): React.ReactNode {
        const { isHighlighted, isUnread = false, onClick, name, title, ...props } = this.props;

        const classes = classNames({
            "mx_RoomHeader_button": true,
            "mx_RoomHeader_button--highlight": isHighlighted,
            "mx_RoomHeader_button--unread": isUnread,
            [`mx_RightPanel_${name}`]: true,
        });

        return (
            <AccessibleTooltipButton
                {...props}
                aria-current={isHighlighted ? "true" : "false"}
                title={title}
                alignment={Alignment.Bottom}
                className={classes}
                onClick={onClick}
            />
        );
    }
}
