/*
Copyright 2015, 2016 OpenMarket Ltd
Copyright 2017, 2018 Vector Creations Ltd
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

import * as React from "react";
import { createRef } from "react";
import { Room } from "matrix-js-sdk/src/models/room";
import classNames from 'classnames';
import IndicatorScrollbar from "../../structures/IndicatorScrollbar";
import * as RoomNotifs from '../../../RoomNotifs';
import { RovingTabIndexWrapper } from "../../../accessibility/RovingTabIndex";
import { _t } from "../../../languageHandler";
import AccessibleButton from "../../views/elements/AccessibleButton";
import AccessibleTooltipButton from "../../views/elements/AccessibleTooltipButton";
import * as FormattingUtils from '../../../utils/FormattingUtils';
import RoomTile2 from "./RoomTile2";

/*******************************************************************
 *   CAUTION                                                       *
 *******************************************************************
 * This is a work in progress implementation and isn't complete or *
 * even useful as a component. Please avoid using it until this    *
 * warning disappears.                                             *
 *******************************************************************/

interface IProps {
    forRooms: boolean;
    rooms?: Room[];
    startAsHidden: boolean;
    label: string;
    onAddRoom?: () => void;
    addRoomLabel: string;
    isInvite: boolean;

    // TODO: Collapsed state
    // TODO: Height
    // TODO: Group invites
    // TODO: Calls
    // TODO: forceExpand?
    // TODO: Header clicking
    // TODO: Spinner support for historical
}

interface IState {
}

export default class RoomSublist2 extends React.Component<IProps, IState> {
    private headerButton = createRef();

    public setHeight(size: number) {
        // TODO: Do a thing (maybe - height changes are different in FTUE)
    }

    private hasTiles(): boolean {
        return this.numTiles > 0;
    }

    private get numTiles(): number {
        // TODO: Account for group invites
        return (this.props.rooms || []).length;
    }

    private onAddRoom = (e) => {
        e.stopPropagation();
        if (this.props.onAddRoom) this.props.onAddRoom();
    };

    private renderTiles(): React.ReactElement[] {
        const tiles: React.ReactElement[] = [];

        if (this.props.rooms) {
            for (const room of this.props.rooms) {
                tiles.push(<RoomTile2 room={room} key={`room-${room.roomId}`}/>);
            }
        }

        return tiles;
    }

    private renderHeader(): React.ReactElement {
        const notifications = !this.props.isInvite
            ? RoomNotifs.aggregateNotificationCount(this.props.rooms)
            : {count: 0, highlight: true};
        const notifCount = notifications.count;
        const notifHighlight = notifications.highlight;

        // TODO: Title on collapsed
        // TODO: Incoming call box

        let chevron = null;
        if (this.hasTiles()) {
            const chevronClasses = classNames({
                'mx_RoomSubList_chevron': true,
                'mx_RoomSubList_chevronRight': false, // isCollapsed
                'mx_RoomSubList_chevronDown': true, // !isCollapsed
            });
            chevron = (<div className={chevronClasses}/>);
        }

        return (
            <RovingTabIndexWrapper inputRef={this.headerButton}>
                {({onFocus, isActive, ref}) => {
                    // TODO: Use onFocus
                    const tabIndex = isActive ? 0 : -1;

                    // TODO: Collapsed state
                    let badge;
                    if (true) { // !isCollapsed
                        const badgeClasses = classNames({
                            'mx_RoomSubList_badge': true,
                            'mx_RoomSubList_badgeHighlight': notifHighlight,
                        });
                        // Wrap the contents in a div and apply styles to the child div so that the browser default outline works
                        if (notifCount > 0) {
                            badge = (
                                <AccessibleButton
                                    tabIndex={tabIndex}
                                    className={badgeClasses}
                                    aria-label={_t("Jump to first unread room.")}
                                >
                                    <div>
                                        {FormattingUtils.formatCount(notifCount)}
                                    </div>
                                </AccessibleButton>
                            );
                        } else if (this.props.isInvite && this.hasTiles()) {
                            // Render the `!` badge for invites
                            badge = (
                                <AccessibleButton
                                    tabIndex={tabIndex}
                                    className={badgeClasses}
                                    aria-label={_t("Jump to first invite.")}
                                >
                                    <div>
                                        {FormattingUtils.formatCount(this.numTiles)}
                                    </div>
                                </AccessibleButton>
                            );
                        }
                    }

                    let addRoomButton = null;
                    if (!!this.props.onAddRoom) {
                        addRoomButton = (
                            <AccessibleTooltipButton
                                tabIndex={tabIndex}
                                onClick={this.onAddRoom}
                                className="mx_RoomSubList_addRoom"
                                title={this.props.addRoomLabel || _t("Add room")}
                            />
                        );
                    }

                    // TODO: a11y (see old component)
                    return (
                        <div className={"mx_RoomSubList_labelContainer"}>
                            <AccessibleButton
                                inputRef={ref}
                                tabIndex={tabIndex}
                                className={"mx_RoomSubList_label"}
                                role="treeitem"
                                aria-level="1"
                            >
                                {chevron}
                                <span>{this.props.label}</span>
                            </AccessibleButton>
                            {badge}
                            {addRoomButton}
                        </div>
                    );
                }}
            </RovingTabIndexWrapper>
        );
    }

    public render(): React.ReactElement {
        // TODO: Proper rendering
        // TODO: Error boundary

        const tiles = this.renderTiles();

        const classes = classNames({
            // TODO: Proper collapse support
            'mx_RoomSubList': true,
            'mx_RoomSubList_hidden': false, // len && isCollapsed
            'mx_RoomSubList_nonEmpty': this.hasTiles(), // len && !isCollapsed
        });

        let content = null;
        if (tiles.length > 0) {
            // TODO: Lazy list rendering
            // TODO: Whatever scrolling magic needs to happen here
            content = (
                <IndicatorScrollbar className='mx_RoomSubList_scroll'>
                    {tiles}
                </IndicatorScrollbar>
            )
        }

        // TODO: onKeyDown support
        return (
            <div
                className={classes}
                role="group"
                aria-label={this.props.label}
            >
                {this.renderHeader()}
                {content}
            </div>
        );
    }
}
