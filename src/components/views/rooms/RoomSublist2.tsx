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
import { DefaultTagID, TagID } from "../../../stores/room-list/models";
import dis from "../../../dispatcher/dispatcher";

// TODO: Remove banner on launch: https://github.com/vector-im/riot-web/issues/14231
// TODO: Rename on launch: https://github.com/vector-im/riot-web/issues/14231

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

    // TODO: Don't use this. It's for community invites, and community invites shouldn't be here.
    // You should feel bad if you use this.
    extraBadTilesThatShouldntExist?: React.ReactElement[];

    // TODO: Account for https://github.com/vector-im/riot-web/issues/14179
}

type PartialDOMRect = Pick<DOMRect, "left" | "top" | "height">;

interface IState {
    notificationState: ListNotificationState;
    contextMenuPosition: PartialDOMRect;
    isResizing: boolean;
}

export default class RoomSublist2 extends React.Component<IProps, IState> {
    constructor(props: IProps) {
        super(props);

        this.state = {
            notificationState: new ListNotificationState(this.props.isInvite, this.props.tagId),
            contextMenuPosition: null,
            isResizing: false,
        };
        this.state.notificationState.setRooms(this.props.rooms);
    }

    private get numTiles(): number {
        return (this.props.rooms || []).length + (this.props.extraBadTilesThatShouldntExist || []).length;
    }

    private get numVisibleTiles(): number {
        if (!this.props.layout) return 0;
        const nVisible = Math.floor(this.props.layout.visibleTiles);
        return Math.min(nVisible, this.numTiles);
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
        this.props.layout.setVisibleTilesWithin(tileDiff, this.numTiles);
        this.forceUpdate(); // because the layout doesn't trigger a re-render
    };

    private onResizeStart = () => {
        this.setState({isResizing: true});
    };

    private onResizeStop = () => {
        this.setState({isResizing: false});
    };

    private onShowAllClick = () => {
        this.props.layout.visibleTiles = this.props.layout.tilesWithPadding(this.numTiles, MAX_PADDING_HEIGHT);
        this.forceUpdate(); // because the layout doesn't trigger a re-render
    };

    private onShowLessClick = () => {
        this.props.layout.visibleTiles = this.props.layout.defaultVisibleTiles;
        this.forceUpdate(); // because the layout doesn't trigger a re-render
    };

    private onOpenMenuClick = (ev: InputEvent) => {
        ev.preventDefault();
        ev.stopPropagation();
        const target = ev.target as HTMLButtonElement;
        this.setState({contextMenuPosition: target.getBoundingClientRect()});
    };

    private onContextMenu = (ev: React.MouseEvent) => {
        ev.preventDefault();
        ev.stopPropagation();
        this.setState({
            contextMenuPosition: {
                left: ev.clientX,
                top: ev.clientY,
                height: 0,
            },
        });
    };

    private onCloseMenu = () => {
        this.setState({contextMenuPosition: null});
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

    private onBadgeClick = (ev: React.MouseEvent) => {
        ev.preventDefault();
        ev.stopPropagation();

        let room;
        if (this.props.tagId === DefaultTagID.Invite) {
            // switch to first room as that'll be the top of the list for the user
            room = this.props.rooms && this.props.rooms[0];
        } else {
            // find the first room with a count of the same colour as the badge count
            room = this.props.rooms.find((r: Room) => {
                const notifState = this.state.notificationState.getForRoom(r);
                return notifState.count > 0 && notifState.color === this.state.notificationState.color;
            });
        }

        if (room) {
            dis.dispatch({
                action: 'view_room',
                room_id: room.roomId,
            });
        }
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

    private renderVisibleTiles(): React.ReactElement[] {
        if (this.props.layout && this.props.layout.isCollapsed) {
            // don't waste time on rendering
            return [];
        }

        const tiles: React.ReactElement[] = [];

        if (this.props.extraBadTilesThatShouldntExist) {
            tiles.push(...this.props.extraBadTilesThatShouldntExist);
        }

        if (this.props.rooms) {
            const visibleRooms = this.props.rooms.slice(0, this.numVisibleTiles);
            for (const room of visibleRooms) {
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

        // We only have to do this because of the extra tiles. We do it conditionally
        // to avoid spending cycles on slicing. It's generally fine to do this though
        // as users are unlikely to have more than a handful of tiles when the extra
        // tiles are used.
        if (tiles.length > this.numVisibleTiles) {
            return tiles.slice(0, this.numVisibleTiles);
        }

        return tiles;
    }

    private renderMenu(): React.ReactElement {
        // TODO: Get a proper invite context menu, or take invites out of the room list.
        if (this.props.tagId === DefaultTagID.Invite) {
            return null;
        }

        let contextMenu = null;
        if (this.state.contextMenuPosition) {
            const isAlphabetical = RoomListStore.instance.getTagSorting(this.props.tagId) === SortAlgorithm.Alphabetic;
            const isUnreadFirst = RoomListStore.instance.getListOrder(this.props.tagId) === ListAlgorithm.Importance;
            contextMenu = (
                <ContextMenu
                    chevronFace="none"
                    left={this.state.contextMenuPosition.left}
                    top={this.state.contextMenuPosition.top + this.state.contextMenuPosition.height}
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
                    label={_t("List options")}
                    isExpanded={!!this.state.contextMenuPosition}
                />
                {contextMenu}
            </React.Fragment>
        );
    }

    private renderHeader(): React.ReactElement {
        return (
            <RovingTabIndexWrapper>
                {({onFocus, isActive, ref}) => {
                    // TODO: Use onFocus: https://github.com/vector-im/riot-web/issues/14180
                    const tabIndex = isActive ? 0 : -1;

                    const badge = (
                        <NotificationBadge
                            forceCount={true}
                            notification={this.state.notificationState}
                            onClick={this.onBadgeClick}
                            tabIndex={tabIndex}
                        />
                    );

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

                    // TODO: a11y (see old component): https://github.com/vector-im/riot-web/issues/14180
                    // Note: the addRoomButton conditionally gets moved around
                    // the DOM depending on whether or not the list is minimized.
                    // If we're minimized, we want it below the header so it
                    // doesn't become sticky.
                    // The same applies to the notification badge.
                    return (
                        <div className={classes}>
                            <div className='mx_RoomSublist2_stickable'>
                                <AccessibleButton
                                    onFocus={onFocus}
                                    inputRef={ref}
                                    tabIndex={tabIndex}
                                    className={"mx_RoomSublist2_headerText"}
                                    role="treeitem"
                                    aria-level={1}
                                    onClick={this.onHeaderClick}
                                    onContextMenu={this.onContextMenu}
                                >
                                    <span className={collapseClasses} />
                                    <span>{this.props.label}</span>
                                </AccessibleButton>
                                {this.renderMenu()}
                                {this.props.isMinimized ? null : badgeContainer}
                                {this.props.isMinimized ? null : addRoomButton}
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
        // TODO: Error boundary: https://github.com/vector-im/riot-web/issues/14185

        const visibleTiles = this.renderVisibleTiles();

        const classes = classNames({
            'mx_RoomSublist2': true,
            'mx_RoomSublist2_hasMenuOpen': !!this.state.contextMenuPosition,
            'mx_RoomSublist2_minimized': this.props.isMinimized,
        });

        let content = null;
        if (visibleTiles.length > 0) {
            const layout = this.props.layout; // to shorten calls

            const maxTilesFactored = layout.tilesWithResizerBoxFactor(this.numTiles);
            const showMoreBtnClasses = classNames({
                'mx_RoomSublist2_showNButton': true,
                'mx_RoomSublist2_isCutting': this.state.isResizing && layout.visibleTiles < maxTilesFactored,
            });

            // If we're hiding rooms, show a 'show more' button to the user. This button
            // floats above the resize handle, if we have one present. If the user has all
            // tiles visible, it becomes 'show less'.
            let showNButton = null;
            if (this.numTiles > visibleTiles.length) {
                // we have a cutoff condition - add the button to show all
                const numMissing = this.numTiles - visibleTiles.length;
                let showMoreText = (
                    <span className='mx_RoomSublist2_showNButtonText'>
                        {_t("Show %(count)s more", {count: numMissing})}
                    </span>
                );
                if (this.props.isMinimized) showMoreText = null;
                showNButton = (
                    <div onClick={this.onShowAllClick} className={showMoreBtnClasses}>
                        <span className='mx_RoomSublist2_showMoreButtonChevron mx_RoomSublist2_showNButtonChevron'>
                            {/* set by CSS masking */}
                        </span>
                        {showMoreText}
                    </div>
                );
            } else if (this.numTiles <= visibleTiles.length && this.numTiles > this.props.layout.defaultVisibleTiles) {
                // we have all tiles visible - add a button to show less
                let showLessText = (
                    <span className='mx_RoomSublist2_showNButtonText'>
                        {_t("Show less")}
                    </span>
                );
                if (this.props.isMinimized) showLessText = null;
                showNButton = (
                    <div onClick={this.onShowLessClick} className={showMoreBtnClasses}>
                        <span className='mx_RoomSublist2_showLessButtonChevron mx_RoomSublist2_showNButtonChevron'>
                            {/* set by CSS masking */}
                        </span>
                        {showLessText}
                    </div>
                );
            }

            // Figure out if we need a handle
            let handles = ['s'];
            if (layout.visibleTiles >= this.numTiles && this.numTiles <= layout.minVisibleTiles) {
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

            const relativeTiles = layout.tilesWithPadding(this.numTiles, padding);
            const minTilesPx = layout.calculateTilesToPixelsMin(relativeTiles, layout.minVisibleTiles, padding);
            const maxTilesPx = layout.tilesToPixelsWithPadding(this.numTiles, padding);
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
                    onResizeStart={this.onResizeStart}
                    onResizeStop={this.onResizeStop}
                >
                    {visibleTiles}
                    {showNButton}
                </ResizableBox>
            );
        }

        // TODO: onKeyDown support: https://github.com/vector-im/riot-web/issues/14180
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
