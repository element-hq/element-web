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
import {RovingAccessibleButton, RovingTabIndexWrapper} from "../../../accessibility/RovingTabIndex";
import { _t } from "../../../languageHandler";
import AccessibleButton from "../../views/elements/AccessibleButton";
import RoomTile2 from "./RoomTile2";
import { ListLayout } from "../../../stores/room-list/ListLayout";
import {
    ChevronFace,
    ContextMenu,
    ContextMenuButton,
    StyledMenuItemCheckbox,
    StyledMenuItemRadio,
} from "../../structures/ContextMenu";
import RoomListStore from "../../../stores/room-list/RoomListStore2";
import { ListAlgorithm, SortAlgorithm } from "../../../stores/room-list/algorithms/models";
import { DefaultTagID, TagID } from "../../../stores/room-list/models";
import dis from "../../../dispatcher/dispatcher";
import NotificationBadge from "./NotificationBadge";
import { ListNotificationState } from "../../../stores/notifications/ListNotificationState";
import AccessibleTooltipButton from "../elements/AccessibleTooltipButton";
import { Key } from "../../../Keyboard";
import defaultDispatcher from "../../../dispatcher/dispatcher";
import {ActionPayload} from "../../../dispatcher/payloads";
import { Enable, Resizable } from "re-resizable";
import { Direction } from "re-resizable/lib/resizer";
import { polyfillTouchEvent } from "../../../@types/polyfill";
import { RoomNotificationStateStore } from "../../../stores/notifications/RoomNotificationStateStore";
import RoomListLayoutStore from "../../../stores/room-list/RoomListLayoutStore";
import { Action } from "../../../dispatcher/actions";

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
export const HEADER_HEIGHT = 32; // As defined by CSS

const MAX_PADDING_HEIGHT = SHOW_N_BUTTON_HEIGHT + RESIZE_HANDLE_HEIGHT;

// HACK: We really shouldn't have to do this.
polyfillTouchEvent();

interface IProps {
    forRooms: boolean;
    rooms?: Room[];
    startAsHidden: boolean;
    label: string;
    onAddRoom?: () => void;
    addRoomLabel: string;
    isMinimized: boolean;
    tagId: TagID;
    onResize: () => void;
    isFiltered: boolean;

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
    isExpanded: boolean; // used for the for expand of the sublist when the room list is being filtered
}

export default class RoomSublist2 extends React.Component<IProps, IState> {
    private headerButton = createRef<HTMLDivElement>();
    private sublistRef = createRef<HTMLDivElement>();
    private dispatcherRef: string;
    private layout: ListLayout;

    constructor(props: IProps) {
        super(props);

        this.layout = RoomListLayoutStore.instance.getLayoutFor(this.props.tagId);

        this.state = {
            notificationState: RoomNotificationStateStore.instance.getListState(this.props.tagId),
            contextMenuPosition: null,
            isResizing: false,
            isExpanded: this.props.isFiltered ? this.props.isFiltered : !this.layout.isCollapsed
        };
        this.state.notificationState.setRooms(this.props.rooms);
        this.dispatcherRef = defaultDispatcher.register(this.onAction);
    }

    private get numTiles(): number {
        return (this.props.rooms || []).length + (this.props.extraBadTilesThatShouldntExist || []).length;
    }

    private get numVisibleTiles(): number {
        const nVisible = Math.floor(this.layout.visibleTiles);
        return Math.min(nVisible, this.numTiles);
    }

    public componentDidUpdate(prevProps: Readonly<IProps>) {
        this.state.notificationState.setRooms(this.props.rooms);
        if (prevProps.isFiltered !== this.props.isFiltered) {
            if (this.props.isFiltered) {
                this.setState({isExpanded: true});
            } else {
                this.setState({isExpanded: !this.layout.isCollapsed});
            }
        }
    }

    public componentWillUnmount() {
        this.state.notificationState.destroy();
        defaultDispatcher.unregister(this.dispatcherRef);
    }

    private onAction = (payload: ActionPayload) => {
        if (payload.action === "view_room" && payload.show_room_tile && this.props.rooms) {
            // XXX: we have to do this a tick later because we have incorrect intermediate props during a room change
            // where we lose the room we are changing from temporarily and then it comes back in an update right after.
            setImmediate(() => {
                const roomIndex = this.props.rooms.findIndex((r) => r.roomId === payload.room_id);

                if (!this.state.isExpanded && roomIndex > -1) {
                    this.toggleCollapsed();
                }
                // extend the visible section to include the room if it is entirely invisible
                if (roomIndex >= this.numVisibleTiles) {
                    this.layout.visibleTiles = this.layout.tilesWithPadding(roomIndex + 1, MAX_PADDING_HEIGHT);
                    this.forceUpdate(); // because the layout doesn't trigger a re-render
                }
            });
        }
    };

    private onAddRoom = (e) => {
        e.stopPropagation();
        if (this.props.onAddRoom) this.props.onAddRoom();
    };

    private onResize = (
        e: MouseEvent | TouchEvent,
        travelDirection: Direction,
        refToElement: HTMLDivElement,
        delta: { width: number, height: number }, // TODO: Use re-resizer's NumberSize when it is exposed as the type
    ) => {
        // Do some sanity checks, but in reality we shouldn't need these.
        if (travelDirection !== "bottom") return;
        if (delta.height === 0) return; // something went wrong, so just ignore it.

        // NOTE: the movement in the MouseEvent (not present on a TouchEvent) is inaccurate
        // for our purposes. The delta provided by the library is also a change *from when
        // resizing started*, meaning it is fairly useless for us. This is why we just use
        // the client height and run with it.

        const heightBefore = this.layout.visibleTiles;
        const heightInTiles = this.layout.pixelsToTiles(refToElement.clientHeight);
        this.layout.setVisibleTilesWithin(heightInTiles, this.numTiles);
        if (heightBefore === this.layout.visibleTiles) return; // no-op
        this.forceUpdate(); // because the layout doesn't trigger a re-render
    };

    private onResizeStart = () => {
        this.setState({isResizing: true});
    };

    private onResizeStop = () => {
        this.setState({isResizing: false});
    };

    private onShowAllClick = () => {
        const numVisibleTiles = this.numVisibleTiles;
        this.layout.visibleTiles = this.layout.tilesWithPadding(this.numTiles, MAX_PADDING_HEIGHT);
        this.forceUpdate(); // because the layout doesn't trigger a re-render
        setImmediate(this.focusRoomTile, numVisibleTiles); // focus the tile after the current bottom one
    };

    private onShowLessClick = () => {
        this.layout.visibleTiles = this.layout.defaultVisibleTiles;
        this.forceUpdate(); // because the layout doesn't trigger a re-render
        // focus will flow to the show more button here
    };

    private focusRoomTile = (index: number) => {
        if (!this.sublistRef.current) return;
        const elements = this.sublistRef.current.querySelectorAll<HTMLDivElement>(".mx_RoomTile2");
        const element = elements && elements[index];
        if (element) {
            element.focus();
        }
    };

    private onOpenMenuClick = (ev: React.MouseEvent) => {
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
        this.layout.showPreviews = !this.layout.showPreviews;
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
                show_room_tile: true, // to make sure the room gets scrolled into view
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
        const list = sublist.parentElement.parentElement;
        // the scrollTop is capped at the height of the header in LeftPanel2
        const isAtTop = list.scrollTop <= HEADER_HEIGHT;
        const isSticky = possibleSticky.classList.contains('mx_RoomSublist2_headerContainer_sticky');
        if (isSticky && !isAtTop) {
            // is sticky - jump to list
            sublist.scrollIntoView({behavior: 'smooth'});
        } else {
            // on screen - toggle collapse
            this.toggleCollapsed();
        }
    };

    private toggleCollapsed = () => {
        this.layout.isCollapsed = this.state.isExpanded;
        this.setState({isExpanded: !this.layout.isCollapsed});
        setImmediate(() => this.props.onResize()); // needs to happen when the DOM is updated
    };

    private onHeaderKeyDown = (ev: React.KeyboardEvent) => {
        switch (ev.key) {
            case Key.ARROW_LEFT:
                ev.stopPropagation();
                if (this.state.isExpanded) {
                    // On ARROW_LEFT collapse the room sublist if it isn't already
                    this.toggleCollapsed();
                }
                break;
            case Key.ARROW_RIGHT: {
                ev.stopPropagation();
                if (!this.state.isExpanded) {
                    // On ARROW_RIGHT expand the room sublist if it isn't already
                    this.toggleCollapsed();
                } else if (this.sublistRef.current) {
                    // otherwise focus the first room
                    const element = this.sublistRef.current.querySelector(".mx_RoomTile2") as HTMLDivElement;
                    if (element) {
                        element.focus();
                    }
                }
                break;
            }
        }
    };

    private onKeyDown = (ev: React.KeyboardEvent) => {
        switch (ev.key) {
            // On ARROW_LEFT go to the sublist header
            case Key.ARROW_LEFT:
                ev.stopPropagation();
                this.headerButton.current.focus();
                break;
            // Consume ARROW_RIGHT so it doesn't cause focus to get sent to composer
            case Key.ARROW_RIGHT:
                ev.stopPropagation();
        }
    };

    private renderVisibleTiles(): React.ReactElement[] {
        if (!this.state.isExpanded) {
            // don't waste time on rendering
            return [];
        }

        const tiles: React.ReactElement[] = [];

        if (this.props.rooms) {
            const visibleRooms = this.props.rooms.slice(0, this.numVisibleTiles);
            for (const room of visibleRooms) {
                tiles.push(
                    <RoomTile2
                        room={room}
                        key={`room-${room.roomId}`}
                        showMessagePreview={this.layout.showPreviews}
                        isMinimized={this.props.isMinimized}
                        tag={this.props.tagId}
                    />
                );
            }
        }

        if (this.props.extraBadTilesThatShouldntExist) {
            tiles.push(...this.props.extraBadTilesThatShouldntExist);
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
        let contextMenu = null;
        if (this.state.contextMenuPosition) {
            const isAlphabetical = RoomListStore.instance.getTagSorting(this.props.tagId) === SortAlgorithm.Alphabetic;
            const isUnreadFirst = RoomListStore.instance.getListOrder(this.props.tagId) === ListAlgorithm.Importance;

            // Invites don't get some nonsense options, so only add them if we have to.
            let otherSections = null;
            if (this.props.tagId !== DefaultTagID.Invite) {
                otherSections = (
                    <React.Fragment>
                        <hr />
                        <div>
                            <div className='mx_RoomSublist2_contextMenu_title'>{_t("Unread rooms")}</div>
                            <StyledMenuItemCheckbox
                                onClose={this.onCloseMenu}
                                onChange={this.onUnreadFirstChanged}
                                checked={isUnreadFirst}
                            >
                                {_t("Always show first")}
                            </StyledMenuItemCheckbox>
                        </div>
                        <hr />
                        <div>
                            <div className='mx_RoomSublist2_contextMenu_title'>{_t("Show")}</div>
                            <StyledMenuItemCheckbox
                                onClose={this.onCloseMenu}
                                onChange={this.onMessagePreviewChanged}
                                checked={this.layout.showPreviews}
                            >
                                {_t("Message preview")}
                            </StyledMenuItemCheckbox>
                        </div>
                    </React.Fragment>
                );
            }

            contextMenu = (
                <ContextMenu
                    chevronFace={ChevronFace.None}
                    left={this.state.contextMenuPosition.left}
                    top={this.state.contextMenuPosition.top + this.state.contextMenuPosition.height}
                    onFinished={this.onCloseMenu}
                >
                    <div className="mx_RoomSublist2_contextMenu">
                        <div>
                            <div className='mx_RoomSublist2_contextMenu_title'>{_t("Sort by")}</div>
                            <StyledMenuItemRadio
                                onClose={this.onCloseMenu}
                                onChange={() => this.onTagSortChanged(SortAlgorithm.Recent)}
                                checked={!isAlphabetical}
                                name={`mx_${this.props.tagId}_sortBy`}
                            >
                                {_t("Activity")}
                            </StyledMenuItemRadio>
                            <StyledMenuItemRadio
                                onClose={this.onCloseMenu}
                                onChange={() => this.onTagSortChanged(SortAlgorithm.Alphabetic)}
                                checked={isAlphabetical}
                                name={`mx_${this.props.tagId}_sortBy`}
                            >
                                {_t("A-Z")}
                            </StyledMenuItemRadio>
                        </div>
                        {otherSections}
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
            <RovingTabIndexWrapper inputRef={this.headerButton}>
                {({onFocus, isActive, ref}) => {
                    const tabIndex = isActive ? 0 : -1;

                    let ariaLabel = _t("Jump to first unread room.");
                    if (this.props.tagId === DefaultTagID.Invite) {
                        ariaLabel = _t("Jump to first invite.");
                    }

                    const badge = (
                        <NotificationBadge
                            forceCount={true}
                            notification={this.state.notificationState}
                            onClick={this.onBadgeClick}
                            tabIndex={tabIndex}
                            aria-label={ariaLabel}
                        />
                    );

                    let addRoomButton = null;
                    if (!!this.props.onAddRoom) {
                        addRoomButton = (
                            <AccessibleTooltipButton
                                tabIndex={tabIndex}
                                onClick={this.onAddRoom}
                                className="mx_RoomSublist2_auxButton"
                                aria-label={this.props.addRoomLabel || _t("Add room")}
                                title={this.props.addRoomLabel}
                                tooltipClassName={"mx_RoomSublist2_addRoomTooltip"}
                            />
                        );
                    }

                    const collapseClasses = classNames({
                        'mx_RoomSublist2_collapseBtn': true,
                        'mx_RoomSublist2_collapseBtn_collapsed': !this.state.isExpanded,
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

                    // Note: the addRoomButton conditionally gets moved around
                    // the DOM depending on whether or not the list is minimized.
                    // If we're minimized, we want it below the header so it
                    // doesn't become sticky.
                    // The same applies to the notification badge.
                    return (
                        <div className={classes} onKeyDown={this.onHeaderKeyDown} onFocus={onFocus} aria-label={this.props.label}>
                            <div className="mx_RoomSublist2_stickable">
                                <AccessibleButton
                                    onFocus={onFocus}
                                    inputRef={ref}
                                    tabIndex={tabIndex}
                                    className="mx_RoomSublist2_headerText"
                                    role="treeitem"
                                    aria-expanded={this.state.isExpanded}
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
            const layout = this.layout; // to shorten calls

            const showMoreBtnClasses = classNames({
                'mx_RoomSublist2_showNButton': true,
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
                    <RovingAccessibleButton onClick={this.onShowAllClick} className={showMoreBtnClasses}>
                        <span className='mx_RoomSublist2_showMoreButtonChevron mx_RoomSublist2_showNButtonChevron'>
                            {/* set by CSS masking */}
                        </span>
                        {showMoreText}
                    </RovingAccessibleButton>
                );
            } else if (this.numTiles <= visibleTiles.length && this.numTiles > this.layout.defaultVisibleTiles) {
                // we have all tiles visible - add a button to show less
                let showLessText = (
                    <span className='mx_RoomSublist2_showNButtonText'>
                        {_t("Show less")}
                    </span>
                );
                if (this.props.isMinimized) showLessText = null;
                showNButton = (
                    <RovingAccessibleButton onClick={this.onShowLessClick} className={showMoreBtnClasses}>
                        <span className='mx_RoomSublist2_showLessButtonChevron mx_RoomSublist2_showNButtonChevron'>
                            {/* set by CSS masking */}
                        </span>
                        {showLessText}
                    </RovingAccessibleButton>
                );
            }

            // Figure out if we need a handle
            const handles: Enable = {
                bottom: true, // the only one we need, but the others must be explicitly false
                bottomLeft: false,
                bottomRight: false,
                left: false,
                right: false,
                top: false,
                topLeft: false,
                topRight: false,
            };
            if (layout.visibleTiles >= this.numTiles && this.numTiles <= layout.minVisibleTiles) {
                // we're at a minimum, don't have a bottom handle
                handles.bottom = false;
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

            // Now that we know our padding constraints, let's find out if we need to chop off the
            // last rendered visible tile so it doesn't collide with the 'show more' button
            let visibleUnpaddedTiles = Math.round(layout.visibleTiles - layout.pixelsToTiles(padding));
            if (visibleUnpaddedTiles === visibleTiles.length - 1) {
                const placeholder = <div className="mx_RoomSublist2_placeholder" key='placeholder' />;
                visibleTiles.splice(visibleUnpaddedTiles, 1, placeholder);
            }

            const dimensions = {
                height: tilesPx,
            };
            content = (
                <Resizable
                    size={dimensions as any}
                    minHeight={minTilesPx}
                    maxHeight={maxTilesPx}
                    onResizeStart={this.onResizeStart}
                    onResizeStop={this.onResizeStop}
                    onResize={this.onResize}
                    handleWrapperClass="mx_RoomSublist2_resizerHandles"
                    handleClasses={{bottom: "mx_RoomSublist2_resizerHandle"}}
                    className="mx_RoomSublist2_resizeBox"
                    enable={handles}
                >
                    {visibleTiles}
                    {showNButton}
                </Resizable>
            );
        }

        return (
            <div
                ref={this.sublistRef}
                className={classes}
                role="group"
                aria-label={this.props.label}
                onKeyDown={this.onKeyDown}
            >
                {this.renderHeader()}
                {content}
            </div>
        );
    }
}
