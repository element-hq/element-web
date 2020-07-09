/*
Copyright 2020 The Matrix.org Foundation C.I.C.

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
import { RovingTabIndexWrapper } from "../../../accessibility/RovingTabIndex";
import AccessibleButton from "../../views/elements/AccessibleButton";
import NotificationBadge from "./NotificationBadge";
import { NotificationState } from "../../../stores/notifications/NotificationState";

interface IProps {
    isMinimized: boolean;
    isSelected: boolean;
    displayName: string;
    avatar: React.ReactElement;
    notificationState: NotificationState;
    onClick: () => void;
}

interface IState {
    hover: boolean;
}

export default class TemporaryTile extends React.Component<IProps, IState> {
    constructor(props: IProps) {
        super(props);

        this.state = {
            hover: false,
        };
    }

    private onTileMouseEnter = () => {
        this.setState({hover: true});
    };

    private onTileMouseLeave = () => {
        this.setState({hover: false});
    };

    public render(): React.ReactElement {
        // XXX: We copy classes because it's easier
        const classes = classNames({
            'mx_RoomTile2': true,
            'mx_TemporaryTile': true,
            'mx_RoomTile2_selected': this.props.isSelected,
            'mx_RoomTile2_minimized': this.props.isMinimized,
        });

        const badge = (
            <NotificationBadge
                notification={this.props.notificationState}
                forceCount={false}
            />
        );

        let name = this.props.displayName;
        if (typeof name !== 'string') name = '';
        name = name.replace(":", ":\u200b"); // add a zero-width space to allow linewrapping after the colon

        const nameClasses = classNames({
            "mx_RoomTile2_name": true,
            "mx_RoomTile2_nameHasUnreadEvents": this.props.notificationState.isUnread,
        });

        let nameContainer = (
            <div className="mx_RoomTile2_nameContainer">
                <div title={name} className={nameClasses} tabIndex={-1} dir="auto">
                    {name}
                </div>
            </div>
        );
        if (this.props.isMinimized) nameContainer = null;

        return (
            <React.Fragment>
                <RovingTabIndexWrapper>
                    {({onFocus, isActive, ref}) =>
                        <AccessibleButton
                            onFocus={onFocus}
                            tabIndex={isActive ? 0 : -1}
                            inputRef={ref}
                            className={classes}
                            onMouseEnter={this.onTileMouseEnter}
                            onMouseLeave={this.onTileMouseLeave}
                            onClick={this.props.onClick}
                            role="treeitem"
                        >
                            <div className="mx_RoomTile2_avatarContainer">
                                {this.props.avatar}
                            </div>
                            {nameContainer}
                            <div className="mx_RoomTile2_badgeContainer">
                                {badge}
                            </div>
                        </AccessibleButton>
                    }
                </RovingTabIndexWrapper>
            </React.Fragment>
        );
    }
}
