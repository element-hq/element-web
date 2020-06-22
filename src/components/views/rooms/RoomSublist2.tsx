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
import { TagID } from "../../../stores/room-list/models";

/*******************************************************************
 *   CAUTION                                                       *
 *******************************************************************
 * This is a work in progress implementation and isn't complete or *
 * even useful as a component. Please avoid using it until this    *
 * warning disappears.                                             *
 *******************************************************************/

const SHOW_N_BUTTON_HEIGHT = 32; // As defined by CSS
const RESIZE_HANDLE_HEIGHT = 4; // As defined by CSS

const MAX_PADDING_HEIGHT = SHOW_N_BUTTON_HEIGHT + RESIZE_HANDLE_HEIGHT;

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
    tagId: TagID;

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
            notificationState: new ListNotificationState(this.props.isInvite, this.props.tagId),
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
        this.props.layout.visibleTiles = this.props.layout.tilesWithPadding(this.numTiles, MAX_PADDING_HEIGHT);
        this.forceUpdate(); // because the layout doesn't trigger a re-render
    };

    private onShowLessClick = () => {
        this.props.layout.visibleTiles = this.props.layout.minVisibleTiles;
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
        const isUnreadFirst = RoomListStore.instance.getListOrder(this.props.tagId) === ListAlgorithm.Importance;
        const newAlgorithm = isUnreadFirst ? ListAlgorithm.Natural : ListAlgorithm.Importance;
        await RoomListStore.instance.setListOrder(this.props.tagId, newAlgorithm);
    };

    private onTagSortChanged = async (sort: SortAlgorithm) => {
        await RoomListStore.instance.setTagSorting(this.props.tagId, sort);
    };

    private onMessagePreviewChanged = () => {
        this.props.layout.showPreviews = !this.props.layout.showPreviews;
        this.forceUpdate(); // because the layout doesn't trigger a re-render
    };

    private onHeaderClick = (ev: React.MouseEvent<HTMLDivElement>) => {
        let target = ev.target as HTMLDivElement;
        if (!target.classList.contains('mx_RoomSublist2_headerText')) {
            // If we don't have the headerText class, the user clicked the span in the headerText.
            target = target.parentElement as HTMLDivElement;
        }

        const possibleSticky = target.parentElement;
        const sublist = possibleSticky.parentElement.parentElement;
        if (possibleSticky.classList.contains('mx_RoomSublist2_headerContainer_sticky')) {
            // is sticky - jump to list
            sublist.scrollIntoView({behavior: 'smooth'});
        } else {
            // on screen - toggle collapse
            this.props.layout.isCollapsed = !this.props.layout.isCollapsed;
            this.forceUpdate(); // because the layout doesn't trigger an update
        }
    };

    private renderTiles(): React.ReactElement[] {
        if (this.props.layout && this.props.layout.isCollapsed) return []; // don't waste time on rendering

        const tiles: React.ReactElement[] = [];

        if (this.props.rooms) {
            for (const room of this.props.rooms) {
                tiles.push(
                    <RoomTile2
                        room={room}
                        key={`room-${room.roomId}`}
                        showMessagePreview={this.props.layout.showPreviews}
                        isMinimized={this.props.isMinimized}
                        tag={this.props.tagId}
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
            const isAlphabetical = RoomListStore.instance.getTagSorting(this.props.tagId) === SortAlgorithm.Alphabetic;
            const isUnreadFirst = RoomListStore.instance.getListOrder(this.props.tagId) === ListAlgorithm.Importance;
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
                                name={`mx_${this.props.tagId}_sortBy`}
                            >
                                {_t("Activity")}
                            </StyledRadioButton>
                            <StyledRadioButton
                                onChange={() => this.onTagSortChanged(SortAlgorithm.Alphabetic)}
                                checked={isAlphabetical}
                                name={`mx_${this.props.tagId}_sortBy`}
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

                    const badge = <NotificationBadge forceCount={true} notification={this.state.notificationState}/>;

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

                    const collapseClasses = classNames({
                        'mx_RoomSublist2_collapseBtn': true,
                        'mx_RoomSublist2_collapseBtn_collapsed': this.props.layout && this.props.layout.isCollapsed,
                    });

                    const classes = classNames({
                        'mx_RoomSublist2_headerContainer': true,
                        'mx_RoomSublist2_headerContainer_withAux': !!addRoomButton,
                    });

                    const badgeContainer = (
                        <div className="mx_RoomSublist2_badgeContainer">
                            {badge}
                        </div>
                    );

                    // TODO: a11y (see old component)
                    // Note: the addRoomButton conditionally gets moved around
                    // the DOM depending on whether or not the list is minimized.
                    // If we're minimized, we want it below the header so it
                    // doesn't become sticky.
                    // The same applies to the notification badge.
                    return (
                        <div className={classes}>
                            <div className='mx_RoomSublist2_stickable'>
                                <AccessibleButton
                                    inputRef={ref}
                                    tabIndex={tabIndex}
                                    className={"mx_RoomSublist2_headerText"}
                                    role="treeitem"
                                    aria-level={1}
                                    onClick={this.onHeaderClick}
                                >
                                    <span className={collapseClasses} />
                                    <span>{this.props.label}</span>
                                </AccessibleButton>
                                {this.renderMenu()}
                                {this.props.isMinimized ? null : addRoomButton}
                                {this.props.isMinimized ? null : badgeContainer}
                            </div>
                            {this.props.isMinimized ? badgeContainer : null}
                            {this.props.isMinimized ? addRoomButton : null}
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
            // floats above the resize handle, if we have one present. If the user has all
            // tiles visible, it becomes 'show less'.
            let showNButton = null;
            if (tiles.length > nVisible) {
                // we have a cutoff condition - add the button to show all
                const numMissing = tiles.length - visibleTiles.length;
                let showMoreText = (
                    <span className='mx_RoomSublist2_showNButtonText'>
                        {_t("Show %(count)s more", {count: numMissing})}
                    </span>
                );
                if (this.props.isMinimized) showMoreText = null;
                showNButton = (
                    <div onClick={this.onShowAllClick} className='mx_RoomSublist2_showNButton'>
                        <span className='mx_RoomSublist2_showMoreButtonChevron mx_RoomSublist2_showNButtonChevron'>
                            {/* set by CSS masking */}
                        </span>
                        {showMoreText}
                    </div>
                );
            } else if (tiles.length <= nVisible && tiles.length > this.props.layout.minVisibleTiles) {
                // we have all tiles visible - add a button to show less
                let showLessText = (
                    <span className='mx_RoomSublist2_showNButtonText'>
                        {_t("Show less")}
                    </span>
                );
                if (this.props.isMinimized) showLessText = null;
                showNButton = (
                    <div onClick={this.onShowLessClick} className='mx_RoomSublist2_showNButton'>
                        <span className='mx_RoomSublist2_showLessButtonChevron mx_RoomSublist2_showNButtonChevron'>
                            {/* set by CSS masking */}
                        </span>
                        {showLessText}
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

            // The padding is variable though, so figure out what we need padding for.
            let padding = 0;
            if (showNButton) padding += SHOW_N_BUTTON_HEIGHT;
            padding += RESIZE_HANDLE_HEIGHT; // always append the handle height

            const relativeTiles = layout.tilesWithPadding(tiles.length, padding);
            const minTilesPx = layout.calculateTilesToPixelsMin(relativeTiles, layout.minVisibleTiles, padding);
            const maxTilesPx = layout.tilesToPixelsWithPadding(tiles.length, padding);
            const tilesWithoutPadding = Math.min(relativeTiles, layout.visibleTiles);
            const tilesPx = layout.calculateTilesToPixelsMin(relativeTiles, tilesWithoutPadding, padding);

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
                    {showNButton}
                </ResizableBox>
            );
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
