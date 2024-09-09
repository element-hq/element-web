/*
Copyright 2024 New Vector Ltd.
Copyright 2019 The Matrix.org Foundation C.I.C.
Copyright 2018 New Vector Ltd
Copyright 2017 Vector Creations Ltd
Copyright 2017 New Vector Ltd
Copyright 2015, 2016 OpenMarket Ltd

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import React, { ReactNode } from "react";
import classNames from "classnames";

import AccessibleButton, { ButtonEvent } from "../elements/AccessibleButton";

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
            "mx_LegacyRoomHeader_button": true,
            "mx_LegacyRoomHeader_button--highlight": isHighlighted,
            "mx_LegacyRoomHeader_button--unread": isUnread,
            [`mx_RightPanel_${name}`]: true,
        });

        return (
            <AccessibleButton
                {...props}
                aria-current={isHighlighted ? "true" : "false"}
                title={title}
                placement="bottom"
                className={classes}
                onClick={onClick}
            />
        );
    }
}
