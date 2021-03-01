/*
Copyright 2021 The Matrix.org Foundation C.I.C.

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
import {Room} from "matrix-js-sdk/src/models/room";

import RoomAvatar from "../avatars/RoomAvatar";
import SpaceStore from "../../../stores/SpaceStore";
import NotificationBadge from "../rooms/NotificationBadge";
import {RovingAccessibleButton} from "../../../accessibility/roving/RovingAccessibleButton";
import {RovingAccessibleTooltipButton} from "../../../accessibility/roving/RovingAccessibleTooltipButton";
import MatrixClientContext from "../../../contexts/MatrixClientContext";

interface IItemProps {
    space?: Room;
    activeSpaces: Room[];
    isNested?: boolean;
    isPanelCollapsed?: boolean;
    onExpand?: Function;
}

interface IItemState {
    collapsed: boolean;
    contextMenuPosition: Pick<DOMRect, "right" | "top" | "height">;
}

export class SpaceItem extends React.PureComponent<IItemProps, IItemState> {
    static contextType = MatrixClientContext;

    constructor(props) {
        super(props);

        this.state = {
            collapsed: !props.isNested,   // default to collapsed for root items
            contextMenuPosition: null,
        };
    }

    private toggleCollapse(evt) {
        if (this.props.onExpand && this.state.collapsed) {
            this.props.onExpand();
        }
        this.setState({collapsed: !this.state.collapsed});
        // don't bubble up so encapsulating button for space
        // doesn't get triggered
        evt.stopPropagation();
    }

    private onContextMenu = (ev: React.MouseEvent) => {
        ev.preventDefault();
        ev.stopPropagation();
        this.setState({
            contextMenuPosition: {
                right: ev.clientX,
                top: ev.clientY,
                height: 0,
            },
        });
    }

    private onClick = (ev: React.MouseEvent) => {
        ev.preventDefault();
        ev.stopPropagation();
        SpaceStore.instance.setActiveSpace(this.props.space);
    };

    render() {
        const {space, activeSpaces, isNested} = this.props;

        const forceCollapsed = this.props.isPanelCollapsed;
        const isNarrow = this.props.isPanelCollapsed;
        const collapsed = this.state.collapsed || forceCollapsed;

        const childSpaces = SpaceStore.instance.getChildSpaces(space.roomId);
        const isActive = activeSpaces.includes(space);
        const itemClasses = classNames({
            "mx_SpaceItem": true,
            "collapsed": collapsed,
            "hasSubSpaces": childSpaces && childSpaces.length,
        });
        const classes = classNames("mx_SpaceButton", {
            mx_SpaceButton_active: isActive,
            mx_SpaceButton_hasMenuOpen: !!this.state.contextMenuPosition,
            mx_SpaceButton_narrow: isNarrow,
        });
        const notificationState = SpaceStore.instance.getNotificationState(space.roomId);
        const childItems = childSpaces && !collapsed ? <SpaceTreeLevel
            spaces={childSpaces}
            activeSpaces={activeSpaces}
            isNested={true}
        /> : null;
        let notifBadge;
        if (notificationState) {
            notifBadge = <div className="mx_SpacePanel_badgeContainer">
                <NotificationBadge forceCount={false} notification={notificationState} />
            </div>;
        }

        const avatarSize = isNested ? 24 : 32;

        const toggleCollapseButton = childSpaces && childSpaces.length ?
            <button
                className="mx_SpaceButton_toggleCollapse"
                onClick={evt => this.toggleCollapse(evt)}
            /> : null;

        let button;
        if (isNarrow) {
            button = (
                <RovingAccessibleTooltipButton
                    className={classes}
                    title={space.name}
                    onClick={this.onClick}
                    onContextMenu={this.onContextMenu}
                    forceHide={!!this.state.contextMenuPosition}
                    role="treeitem"
                >
                    { toggleCollapseButton }
                    <div className="mx_SpaceButton_selectionWrapper">
                        <RoomAvatar width={avatarSize} height={avatarSize} room={space} />
                        { notifBadge }
                    </div>
                </RovingAccessibleTooltipButton>
            );
        } else {
            button = (
                <RovingAccessibleButton
                    className={classes}
                    onClick={this.onClick}
                    onContextMenu={this.onContextMenu}
                    role="treeitem"
                >
                    { toggleCollapseButton }
                    <div className="mx_SpaceButton_selectionWrapper">
                        <RoomAvatar width={avatarSize} height={avatarSize} room={space} />
                        <span className="mx_SpaceButton_name">{ space.name }</span>
                        { notifBadge }
                    </div>
                </RovingAccessibleButton>
            );
        }

        return (
            <li className={itemClasses}>
                { button }
                { childItems }
            </li>
        );
    }
}

interface ITreeLevelProps {
    spaces: Room[];
    activeSpaces: Room[];
    isNested?: boolean;
}

const SpaceTreeLevel: React.FC<ITreeLevelProps> = ({
    spaces,
    activeSpaces,
    isNested,
}) => {
    return <ul className="mx_SpaceTreeLevel">
        {spaces.map(s => {
            return (<SpaceItem
                key={s.roomId}
                activeSpaces={activeSpaces}
                space={s}
                isNested={isNested}
            />);
        })}
    </ul>;
}

export default SpaceTreeLevel;
