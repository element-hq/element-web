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
import { RovingTabIndexWrapper } from "../../../accessibility/RovingTabIndex";
import { _t } from "../../../languageHandler";
import AccessibleButton from "../../views/elements/AccessibleButton";
import RoomTile2 from "./RoomTile2";
import { ResizableBox, ResizeCallbackData } from "react-resizable";
import { ListLayout } from "../../../stores/room-list/ListLayout";
import NotificationBadge, { ListNotificationState } from "./NotificationBadge";
import { ContextMenu, ContextMenuButton } from "../../structures/ContextMenu";
import StyledCheckbox from "../elements/StyledCheckbox";
import StyledRadioButton from "../elements/StyledRadioButton";
import RoomListStore from "../../../stores/room-list/RoomListStore2";
import { ListAlgorithm, SortAlgorithm } from "../../../stores/room-list/algorithms/models";

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
    layout: ListLayout;
    isMinimized: boolean;

    // TODO: Collapsed state
    // TODO: Group invites
    // TODO: Calls
    // TODO: forceExpand?
    // TODO: Header clicking
    // TODO: Spinner support for historical
}

interface IState {
    notificationState: ListNotificationState;
    menuDisplayed: boolean;
}

export default class RoomSublist2 extends React.Component<IProps, IState> {
    private headerButton = createRef();
    private menuButtonRef: React.RefObject<HTMLButtonElement> = createRef();

    constructor(props: IProps) {
        super(props);

        this.state = {
            notificationState: new ListNotificationState(this.props.isInvite),
            menuDisplayed: false,
        };
        this.state.notificationState.setRooms(this.props.rooms);
    }

    private get numTiles(): number {
        // TODO: Account for group invites
        return (this.props.rooms || []).length;
    }

    public componentDidUpdate() {
        this.state.notificationState.setRooms(this.props.rooms);
    }

    public componentWillUnmount() {
        this.state.notificationState.destroy();
    }

    private onAddRoom = (e) => {
        e.stopPropagation();
        if (this.props.onAddRoom) this.props.onAddRoom();
    };

    private onResize = (e: React.MouseEvent, data: ResizeCallbackData) => {
        const direction = e.movementY < 0 ? -1 : +1;
        const tileDiff = this.props.layout.pixelsToTiles(Math.abs(e.movementY)) * direction;
        this.props.layout.visibleTiles += tileDiff;
        this.forceUpdate(); // because the layout doesn't trigger a re-render
    };

    private onShowAllClick = () => {
        this.props.layout.visibleTiles = this.numTiles;
        this.forceUpdate(); // because the layout doesn't trigger a re-render
    };

    private onOpenMenuClick = (ev: InputEvent) => {
        ev.preventDefault();
        ev.stopPropagation();
        this.setState({menuDisplayed: true});
    };

    private onCloseMenu = () => {
        this.setState({menuDisplayed: false});
    };

    private onUnreadFirstChanged = async () => {
        const isUnreadFirst = RoomListStore.instance.getListOrder(this.props.layout.tagId) === ListAlgorithm.Importance;
        const newAlgorithm = isUnreadFirst ? ListAlgorithm.Natural : ListAlgorithm.Importance;
        await RoomListStore.instance.setListOrder(this.props.layout.tagId, newAlgorithm);
    };

    private onTagSortChanged = async (sort: SortAlgorithm) => {
        await RoomListStore.instance.setTagSorting(this.props.layout.tagId, sort);
    };

    private onMessagePreviewChanged = () => {
        this.props.layout.showPreviews = !this.props.layout.showPreviews;
        this.forceUpdate(); // because the layout doesn't trigger a re-render
    };

    private renderTiles(): React.ReactElement[] {
        const tiles: React.ReactElement[] = [];

        if (this.props.rooms) {
            for (const room of this.props.rooms) {
                tiles.push(
                    <RoomTile2
                        room={room}
                        key={`room-${room.roomId}`}
                        showMessagePreview={this.props.layout.showPreviews}
                        isMinimized={this.props.isMinimized}
                    />
                );
            }
        }

        return tiles;
    }

    private renderMenu(): React.ReactElement {
        let contextMenu = null;
        if (this.state.menuDisplayed) {
            const elementRect = this.menuButtonRef.current.getBoundingClientRect();
            const isAlphabetical = RoomListStore.instance.getTagSorting(this.props.layout.tagId) === SortAlgorithm.Alphabetic;
            const isUnreadFirst = RoomListStore.instance.getListOrder(this.props.layout.tagId) === ListAlgorithm.Importance;
            contextMenu = (
                <ContextMenu
                    chevronFace="none"
                    left={elementRect.left}
                    top={elementRect.top + elementRect.height}
                    onFinished={this.onCloseMenu}
                >
                    <div className="mx_RoomSublist2_contextMenu">
                        <div>
                            <div className='mx_RoomSublist2_contextMenu_title'>{_t("Sort by")}</div>
                            <StyledRadioButton
                                onChange={() => this.onTagSortChanged(SortAlgorithm.Recent)}
                                checked={!isAlphabetical}
                                name={`mx_${this.props.layout.tagId}_sortBy`}
                            >
                                {_t("Activity")}
                            </StyledRadioButton>
                            <StyledRadioButton
                                onChange={() => this.onTagSortChanged(SortAlgorithm.Alphabetic)}
                                checked={isAlphabetical}
                                name={`mx_${this.props.layout.tagId}_sortBy`}
                            >
                                {_t("A-Z")}
                            </StyledRadioButton>
                        </div>
                        <hr />
                        <div>
                            <div className='mx_RoomSublist2_contextMenu_title'>{_t("Unread rooms")}</div>
                            <StyledCheckbox
                                onChange={this.onUnreadFirstChanged}
                                checked={isUnreadFirst}
                            >
                                {_t("Always show first")}
                            </StyledCheckbox>
                        </div>
                        <hr />
                        <div>
                            <div className='mx_RoomSublist2_contextMenu_title'>{_t("Show")}</div>
                            <StyledCheckbox
                                onChange={this.onMessagePreviewChanged}
                                checked={this.props.layout.showPreviews}
                            >
                                {_t("Message preview")}
                            </StyledCheckbox>
                        </div>
                    </div>
                </ContextMenu>
            );
        }

        return (
            <React.Fragment>
                <ContextMenuButton
                    className="mx_RoomSublist2_menuButton"
                    onClick={this.onOpenMenuClick}
                    inputRef={this.menuButtonRef}
                    label={_t("List options")}
                    isExpanded={this.state.menuDisplayed}
                />
                {contextMenu}
            </React.Fragment>
        );
    }

    private renderHeader(): React.ReactElement {
        // TODO: Title on collapsed
        // TODO: Incoming call box

        return (
            <RovingTabIndexWrapper inputRef={this.headerButton}>
                {({onFocus, isActive, ref}) => {
                    // TODO: Use onFocus
                    const tabIndex = isActive ? 0 : -1;

                    // TODO: Collapsed state

                    const badge = <NotificationBadge allowNoCount={false} notification={this.state.notificationState}/>;

                    let addRoomButton = null;
                    if (!!this.props.onAddRoom) {
                        addRoomButton = (
                            <AccessibleButton
                                tabIndex={tabIndex}
                                onClick={this.onAddRoom}
                                className="mx_RoomSublist2_auxButton"
                                aria-label={this.props.addRoomLabel || _t("Add room")}
                            />
                        );
                    }

                    const classes = classNames({
                        'mx_RoomSublist2_headerContainer': true,
                        'mx_RoomSublist2_headerContainer_withAux': !!addRoomButton,
                    });

                    // TODO: a11y (see old component)
                    return (
                        <div className={classes}>
                            <AccessibleButton
                                inputRef={ref}
                                tabIndex={tabIndex}
                                className={"mx_RoomSublist2_headerText"}
                                role="treeitem"
                                aria-level={1}
                            >
                                <span>{this.props.label}</span>
                            </AccessibleButton>
                            {this.renderMenu()}
                            {addRoomButton}
                            <div className="mx_RoomSublist2_badgeContainer">
                                {badge}
                            </div>
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
            'mx_RoomSublist2': true,
            'mx_RoomSublist2_collapsed': false, // len && isCollapsed
            'mx_RoomSublist2_hasMenuOpen': this.state.menuDisplayed,
            'mx_RoomSublist2_minimized': this.props.isMinimized,
        });

        let content = null;
        if (tiles.length > 0) {
            const layout = this.props.layout; // to shorten calls

            // TODO: Lazy list rendering
            // TODO: Whatever scrolling magic needs to happen here

            const nVisible = Math.floor(layout.visibleTiles);
            const visibleTiles = tiles.slice(0, nVisible);

            // If we're hiding rooms, show a 'show more' button to the user. This button
            // floats above the resize handle, if we have one present
            let showMoreButton = null;
            if (tiles.length > nVisible) {
                // we have a cutoff condition - add the button to show all
                const numMissing = tiles.length - visibleTiles.length;
                let showMoreText = (
                    <span className='mx_RoomSublist2_showMoreButtonText'>
                        {_t("Show %(count)s more", {count: numMissing})}
                    </span>
                );
                if (this.props.isMinimized) showMoreText = null;
                showMoreButton = (
                    <div onClick={this.onShowAllClick} className='mx_RoomSublist2_showMoreButton'>
                        <span className='mx_RoomSublist2_showMoreButtonChevron'>
                            {/* set by CSS masking */}
                        </span>
                        {showMoreText}
                    </div>
                );
            }

            // Figure out if we need a handle
            let handles = ['s'];
            if (layout.visibleTiles >= tiles.length && tiles.length <= layout.minVisibleTiles) {
                handles = []; // no handles, we're at a minimum
            }

            // We have to account for padding so we can accommodate a 'show more' button and
            // the resize handle, which are pinned to the bottom of the container. This is the
            // easiest way to have a resize handle below the button as otherwise we're writing
            // our own resize handling and that doesn't sound fun.
            //
            // The layout class has some helpers for dealing with padding, as we don't want to
            // apply it in all cases. If we apply it in all cases, the resizing feels like it
            // goes backwards and can become wildly incorrect (visibleTiles says 18 when there's
            // only mathematically 7 possible).

            const showMoreHeight = 32; // As defined by CSS
            const resizeHandleHeight = 4; // As defined by CSS

            // The padding is variable though, so figure out what we need padding for.
            let padding = 0;
            if (showMoreButton) padding += showMoreHeight;
            if (handles.length > 0) padding += resizeHandleHeight;

            const minTilesPx = layout.calculateTilesToPixelsMin(tiles.length, layout.minVisibleTiles, padding);
            const maxTilesPx = layout.tilesToPixelsWithPadding(tiles.length, padding);
            const tilesWithoutPadding = Math.min(tiles.length, layout.visibleTiles);
            const tilesPx = layout.calculateTilesToPixelsMin(tiles.length, tilesWithoutPadding, padding);

            content = (
                <ResizableBox
                    width={-1}
                    height={tilesPx}
                    axis="y"
                    minConstraints={[-1, minTilesPx]}
                    maxConstraints={[-1, maxTilesPx]}
                    resizeHandles={handles}
                    onResize={this.onResize}
                    className="mx_RoomSublist2_resizeBox"
                >
                    {visibleTiles}
                    {showMoreButton}
                </ResizableBox>
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
