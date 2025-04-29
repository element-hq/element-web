/*
Copyright 2024 New Vector Ltd.
Copyright 2020 The Matrix.org Foundation C.I.C.
Copyright 2017, 2018 Vector Creations Ltd
Copyright 2015, 2016 OpenMarket Ltd

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type Room } from "matrix-js-sdk/src/matrix";
import classNames from "classnames";
import { type Enable, Resizable } from "re-resizable";
import { type Direction } from "re-resizable/lib/resizer";
import React, { type JSX, type ComponentType, createRef, type ReactComponentElement, type ReactNode } from "react";

import { polyfillTouchEvent } from "../../../@types/polyfill";
import { KeyBindingAction } from "../../../accessibility/KeyboardShortcuts";
import { RovingAccessibleButton, RovingTabIndexWrapper } from "../../../accessibility/RovingTabIndex";
import { Action } from "../../../dispatcher/actions";
import defaultDispatcher, { type MatrixDispatcher } from "../../../dispatcher/dispatcher";
import { type ActionPayload } from "../../../dispatcher/payloads";
import { type ViewRoomPayload } from "../../../dispatcher/payloads/ViewRoomPayload";
import { getKeyBindingsManager } from "../../../KeyBindingsManager";
import { _t } from "../../../languageHandler";
import { type ListNotificationState } from "../../../stores/notifications/ListNotificationState";
import { RoomNotificationStateStore } from "../../../stores/notifications/RoomNotificationStateStore";
import { ListAlgorithm, SortAlgorithm } from "../../../stores/room-list/algorithms/models";
import { type ListLayout } from "../../../stores/room-list/ListLayout";
import { DefaultTagID, type TagID } from "../../../stores/room-list/models";
import RoomListLayoutStore from "../../../stores/room-list/RoomListLayoutStore";
import RoomListStore, { LISTS_UPDATE_EVENT, LISTS_LOADING_EVENT } from "../../../stores/room-list/RoomListStore";
import { arrayFastClone, arrayHasOrderChange } from "../../../utils/arrays";
import { objectExcluding, objectHasDiff } from "../../../utils/objects";
import type ResizeNotifier from "../../../utils/ResizeNotifier";
import ContextMenu, {
    ChevronFace,
    ContextMenuTooltipButton,
    StyledMenuItemCheckbox,
    StyledMenuItemRadio,
} from "../../structures/ContextMenu";
import AccessibleButton, { type ButtonEvent } from "../../views/elements/AccessibleButton";
import type ExtraTile from "./ExtraTile";
import NotificationBadge from "./NotificationBadge";
import RoomTile from "./RoomTile";

const SHOW_N_BUTTON_HEIGHT = 28; // As defined by CSS
const RESIZE_HANDLE_HEIGHT = 4; // As defined by CSS
export const HEADER_HEIGHT = 32; // As defined by CSS

const MAX_PADDING_HEIGHT = SHOW_N_BUTTON_HEIGHT + RESIZE_HANDLE_HEIGHT;

// HACK: We really shouldn't have to do this.
polyfillTouchEvent();

export interface IAuxButtonProps {
    tabIndex: number;
    dispatcher?: MatrixDispatcher;
}

interface IProps {
    forRooms: boolean;
    startAsHidden: boolean;
    label: string;
    AuxButtonComponent?: ComponentType<IAuxButtonProps>;
    isMinimized: boolean;
    tagId: TagID;
    showSkeleton?: boolean;
    alwaysVisible?: boolean;
    forceExpanded?: boolean;
    resizeNotifier: ResizeNotifier;
    extraTiles?: ReactComponentElement<typeof ExtraTile>[] | null;
    onListCollapse?: (isExpanded: boolean) => void;
}

function getLabelId(tagId: TagID): string {
    return `mx_RoomSublist_label_${tagId}`;
}

// TODO: Use re-resizer's NumberSize when it is exposed as the type
interface ResizeDelta {
    width: number;
    height: number;
}

type PartialDOMRect = Pick<DOMRect, "left" | "top" | "height">;

interface IState {
    contextMenuPosition?: PartialDOMRect;
    isResizing: boolean;
    isExpanded: boolean; // used for the for expand of the sublist when the room list is being filtered
    height: number;
    rooms: Room[];
    roomsLoading: boolean;
}

export default class RoomSublist extends React.Component<IProps, IState> {
    private headerButton = createRef<HTMLDivElement>();
    private sublistRef = createRef<HTMLDivElement>();
    private tilesRef = createRef<HTMLDivElement>();
    private dispatcherRef?: string;
    private layout: ListLayout;
    private heightAtStart: number;
    private notificationState: ListNotificationState;

    public constructor(props: IProps) {
        super(props);

        this.layout = RoomListLayoutStore.instance.getLayoutFor(this.props.tagId);
        this.heightAtStart = 0;
        this.notificationState = RoomNotificationStateStore.instance.getListState(this.props.tagId);
        this.state = {
            isResizing: false,
            isExpanded: !this.layout.isCollapsed,
            height: 0, // to be fixed in a moment, we need `rooms` to calculate this.
            rooms: arrayFastClone(RoomListStore.instance.orderedLists[this.props.tagId] || []),
            roomsLoading: false,
        };
        // Why Object.assign() and not this.state.height? Because TypeScript says no.
        this.state = Object.assign(this.state, { height: this.calculateInitialHeight() });
    }

    private calculateInitialHeight(): number {
        const requestedVisibleTiles = Math.max(Math.floor(this.layout.visibleTiles), this.layout.minVisibleTiles);
        const tileCount = Math.min(this.numTiles, requestedVisibleTiles);
        return this.layout.tilesToPixelsWithPadding(tileCount, this.padding);
    }

    private get padding(): number {
        let padding = RESIZE_HANDLE_HEIGHT;
        // this is used for calculating the max height of the whole container,
        // and takes into account whether there should be room reserved for the show more/less button
        // when fully expanded. We can't rely purely on the layout's defaultVisible tile count
        // because there are conditions in which we need to know that the 'show more' button
        // is present while well under the default tile limit.
        const needsShowMore = this.numTiles > this.numVisibleTiles;

        // ...but also check this or we'll miss if the section is expanded and we need a
        // 'show less'
        const needsShowLess = this.numTiles > this.layout.defaultVisibleTiles;

        if (needsShowMore || needsShowLess) {
            padding += SHOW_N_BUTTON_HEIGHT;
        }
        return padding;
    }

    private get extraTiles(): ReactComponentElement<typeof ExtraTile>[] | null {
        return this.props.extraTiles ?? null;
    }

    private get numTiles(): number {
        return RoomSublist.calcNumTiles(this.state.rooms, this.extraTiles);
    }

    private static calcNumTiles(rooms: Room[], extraTiles?: any[] | null): number {
        return (rooms || []).length + (extraTiles || []).length;
    }

    private get numVisibleTiles(): number {
        const nVisible = Math.ceil(this.layout.visibleTiles);
        return Math.min(nVisible, this.numTiles);
    }

    public componentDidUpdate(prevProps: Readonly<IProps>, prevState: Readonly<IState>): void {
        const prevExtraTiles = prevProps.extraTiles;
        // as the rooms can come in one by one we need to reevaluate
        // the amount of available rooms to cap the amount of requested visible rooms by the layout
        if (RoomSublist.calcNumTiles(prevState.rooms, prevExtraTiles) !== this.numTiles) {
            this.setState({ height: this.calculateInitialHeight() });
        }
    }

    public shouldComponentUpdate(nextProps: Readonly<IProps>, nextState: Readonly<IState>): boolean {
        if (objectHasDiff(this.props, nextProps)) {
            // Something we don't care to optimize has updated, so update.
            return true;
        }

        // Do the same check used on props for state, without the rooms we're going to no-op
        const prevStateNoRooms = objectExcluding(this.state, ["rooms"]);
        const nextStateNoRooms = objectExcluding(nextState, ["rooms"]);
        if (objectHasDiff(prevStateNoRooms, nextStateNoRooms)) {
            return true;
        }

        // If we're supposed to handle extra tiles, take the performance hit and re-render all the
        // time so we don't have to consider them as part of the visible room optimization.
        const prevExtraTiles = this.props.extraTiles || [];
        const nextExtraTiles = nextProps.extraTiles || [];
        if (prevExtraTiles.length > 0 || nextExtraTiles.length > 0) {
            return true;
        }

        // If we're about to update the height of the list, we don't really care about which rooms
        // are visible or not for no-op purposes, so ensure that the height calculation runs through.
        if (RoomSublist.calcNumTiles(nextState.rooms, nextExtraTiles) !== this.numTiles) {
            return true;
        }

        // Before we go analyzing the rooms, we can see if we're collapsed. If we're collapsed, we don't need
        // to render anything. We do this after the height check though to ensure that the height gets appropriately
        // calculated for when/if we become uncollapsed.
        if (!nextState.isExpanded) {
            return false;
        }

        // Quickly double check we're not about to break something due to the number of rooms changing.
        if (this.state.rooms.length !== nextState.rooms.length) {
            return true;
        }

        // Finally, determine if the room update (as presumably that's all that's left) is within
        // our visible range. If it is, then do a render. If the update is outside our visible range
        // then we can skip the update.
        //
        // We also optimize for order changing here: if the update did happen in our visible range
        // but doesn't result in the list re-sorting itself then there's no reason for us to update
        // on our own.
        const prevSlicedRooms = this.state.rooms.slice(0, this.numVisibleTiles);
        const nextSlicedRooms = nextState.rooms.slice(0, this.numVisibleTiles);
        if (arrayHasOrderChange(prevSlicedRooms, nextSlicedRooms)) {
            return true;
        }

        // Finally, nothing happened so no-op the update
        return false;
    }

    public componentDidMount(): void {
        this.dispatcherRef = defaultDispatcher.register(this.onAction);
        RoomListStore.instance.on(LISTS_UPDATE_EVENT, this.onListsUpdated);
        RoomListStore.instance.on(LISTS_LOADING_EVENT, this.onListsLoading);

        // Using the passive option to not block the main thread
        // https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/addEventListener#improving_scrolling_performance_with_passive_listeners
        this.tilesRef.current?.addEventListener("scroll", this.onScrollPrevent, { passive: true });
    }

    public componentWillUnmount(): void {
        defaultDispatcher.unregister(this.dispatcherRef);
        RoomListStore.instance.off(LISTS_UPDATE_EVENT, this.onListsUpdated);
        RoomListStore.instance.off(LISTS_LOADING_EVENT, this.onListsLoading);
        this.tilesRef.current?.removeEventListener("scroll", this.onScrollPrevent);
    }

    private onListsLoading = (tagId: TagID, isLoading: boolean): void => {
        if (this.props.tagId !== tagId) {
            return;
        }
        this.setState({
            roomsLoading: isLoading,
        });
    };

    private onListsUpdated = (): void => {
        const stateUpdates = {} as IState;

        const currentRooms = this.state.rooms;
        const newRooms = arrayFastClone(RoomListStore.instance.orderedLists[this.props.tagId] || []);
        if (arrayHasOrderChange(currentRooms, newRooms)) {
            stateUpdates.rooms = newRooms;
        }

        if (Object.keys(stateUpdates).length > 0) {
            this.setState(stateUpdates);
        }
    };

    private onAction = (payload: ActionPayload): void => {
        if (payload.action === Action.ViewRoom && payload.show_room_tile && this.state.rooms) {
            // XXX: we have to do this a tick later because we have incorrect intermediate props during a room change
            // where we lose the room we are changing from temporarily and then it comes back in an update right after.
            setTimeout(() => {
                const roomIndex = this.state.rooms.findIndex((r) => r.roomId === payload.room_id);

                if (!this.state.isExpanded && roomIndex > -1) {
                    this.toggleCollapsed();
                }
                // extend the visible section to include the room if it is entirely invisible
                if (roomIndex >= this.numVisibleTiles) {
                    this.layout.visibleTiles = this.layout.tilesWithPadding(roomIndex + 1, MAX_PADDING_HEIGHT);
                    this.forceUpdate(); // because the layout doesn't trigger a re-render
                }
            }, 0);
        }
    };

    private applyHeightChange(newHeight: number): void {
        const heightInTiles = Math.ceil(this.layout.pixelsToTiles(newHeight - this.padding));
        this.layout.visibleTiles = Math.min(this.numTiles, heightInTiles);
    }

    private onResize = (
        e: MouseEvent | TouchEvent,
        travelDirection: Direction,
        refToElement: HTMLElement,
        delta: ResizeDelta,
    ): void => {
        const newHeight = this.heightAtStart + delta.height;
        this.applyHeightChange(newHeight);
        this.setState({ height: newHeight });
    };

    private onResizeStart = (): void => {
        this.heightAtStart = this.state.height;
        this.setState({ isResizing: true });
    };

    private onResizeStop = (
        e: MouseEvent | TouchEvent,
        travelDirection: Direction,
        refToElement: HTMLElement,
        delta: ResizeDelta,
    ): void => {
        const newHeight = this.heightAtStart + delta.height;
        this.applyHeightChange(newHeight);
        this.setState({ isResizing: false, height: newHeight });
    };

    private onShowAllClick = async (): Promise<void> => {
        // read number of visible tiles before we mutate it
        const numVisibleTiles = this.numVisibleTiles;
        const newHeight = this.layout.tilesToPixelsWithPadding(this.numTiles, this.padding);
        this.applyHeightChange(newHeight);
        this.setState({ height: newHeight }, () => {
            // focus the top-most new room
            this.focusRoomTile(numVisibleTiles);
        });
    };

    private onShowLessClick = (): void => {
        const newHeight = this.layout.tilesToPixelsWithPadding(this.layout.defaultVisibleTiles, this.padding);
        this.applyHeightChange(newHeight);
        this.setState({ height: newHeight });
    };

    private focusRoomTile = (index: number): void => {
        if (!this.sublistRef.current) return;
        const elements = this.sublistRef.current.querySelectorAll<HTMLDivElement>(".mx_RoomTile");
        const element = elements && elements[index];
        if (element) {
            element.focus();
        }
    };

    private onOpenMenuClick = (ev: ButtonEvent): void => {
        ev.preventDefault();
        ev.stopPropagation();
        const target = ev.target as HTMLButtonElement;
        this.setState({ contextMenuPosition: target.getBoundingClientRect() });
    };

    private onContextMenu = (ev: React.MouseEvent): void => {
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

    private onCloseMenu = (): void => {
        this.setState({ contextMenuPosition: undefined });
    };

    private onUnreadFirstChanged = (): void => {
        const isUnreadFirst = RoomListStore.instance.getListOrder(this.props.tagId) === ListAlgorithm.Importance;
        const newAlgorithm = isUnreadFirst ? ListAlgorithm.Natural : ListAlgorithm.Importance;
        RoomListStore.instance.setListOrder(this.props.tagId, newAlgorithm);
        this.forceUpdate(); // because if the sublist doesn't have any changes then we will miss the list order change
    };

    private onTagSortChanged = async (sort: SortAlgorithm): Promise<void> => {
        RoomListStore.instance.setTagSorting(this.props.tagId, sort);
        this.forceUpdate();
    };

    private onMessagePreviewChanged = (): void => {
        this.layout.showPreviews = !this.layout.showPreviews;
        this.forceUpdate(); // because the layout doesn't trigger a re-render
    };

    private onBadgeClick = (ev: React.MouseEvent): void => {
        ev.preventDefault();
        ev.stopPropagation();

        let room;
        if (this.props.tagId === DefaultTagID.Invite) {
            // switch to first room as that'll be the top of the list for the user
            room = this.state.rooms && this.state.rooms[0];
        } else {
            // find the first room with a count of the same colour as the badge count
            room = RoomListStore.instance.orderedLists[this.props.tagId].find((r: Room) => {
                const notifState = this.notificationState.getForRoom(r);
                return notifState.count > 0 && notifState.level === this.notificationState.level;
            });
        }

        if (room) {
            defaultDispatcher.dispatch<ViewRoomPayload>({
                action: Action.ViewRoom,
                room_id: room.roomId,
                show_room_tile: true, // to make sure the room gets scrolled into view
                metricsTrigger: "WebRoomListNotificationBadge",
                metricsViaKeyboard: ev.type !== "click",
            });
        }
    };

    private onHeaderClick = (): void => {
        const possibleSticky = this.headerButton.current?.parentElement;
        const sublist = possibleSticky?.parentElement?.parentElement;
        const list = sublist?.parentElement?.parentElement;
        if (!possibleSticky || !list) return;

        // the scrollTop is capped at the height of the header in LeftPanel, the top header is always sticky
        const listScrollTop = Math.round(list.scrollTop);
        const isAtTop = listScrollTop <= Math.round(HEADER_HEIGHT);
        const isAtBottom = listScrollTop >= Math.round(list.scrollHeight - list.offsetHeight);
        const isStickyTop = possibleSticky.classList.contains("mx_RoomSublist_headerContainer_stickyTop");
        const isStickyBottom = possibleSticky.classList.contains("mx_RoomSublist_headerContainer_stickyBottom");

        if ((isStickyBottom && !isAtBottom) || (isStickyTop && !isAtTop)) {
            // is sticky - jump to list
            sublist.scrollIntoView({ behavior: "smooth" });
        } else {
            // on screen - toggle collapse
            const isExpanded = this.state.isExpanded;
            this.toggleCollapsed();
            // if the bottom list is collapsed then scroll it in so it doesn't expand off screen
            if (!isExpanded && isStickyBottom) {
                setTimeout(() => {
                    sublist.scrollIntoView({ behavior: "smooth" });
                }, 0);
            }
        }
    };

    private toggleCollapsed = (): void => {
        if (this.props.forceExpanded) return;
        this.layout.isCollapsed = this.state.isExpanded;
        this.setState({ isExpanded: !this.layout.isCollapsed });
        if (this.props.onListCollapse) {
            this.props.onListCollapse(!this.layout.isCollapsed);
        }
    };

    private onHeaderKeyDown = (ev: React.KeyboardEvent): void => {
        const action = getKeyBindingsManager().getRoomListAction(ev);
        switch (action) {
            case KeyBindingAction.CollapseRoomListSection:
                ev.stopPropagation();
                if (this.state.isExpanded) {
                    // Collapse the room sublist if it isn't already
                    this.toggleCollapsed();
                }
                break;
            case KeyBindingAction.ExpandRoomListSection: {
                ev.stopPropagation();
                if (!this.state.isExpanded) {
                    // Expand the room sublist if it isn't already
                    this.toggleCollapsed();
                } else if (this.sublistRef.current) {
                    // otherwise focus the first room
                    const element = this.sublistRef.current.querySelector(".mx_RoomTile") as HTMLDivElement;
                    if (element) {
                        element.focus();
                    }
                }
                break;
            }
        }
    };

    private onKeyDown = (ev: React.KeyboardEvent): void => {
        const action = getKeyBindingsManager().getAccessibilityAction(ev);
        switch (action) {
            // On ArrowLeft go to the sublist header
            case KeyBindingAction.ArrowLeft:
                ev.stopPropagation();
                this.headerButton.current?.focus();
                break;
            // Consume ArrowRight so it doesn't cause focus to get sent to composer
            case KeyBindingAction.ArrowRight:
                ev.stopPropagation();
        }
    };

    private renderVisibleTiles(): React.ReactElement[] {
        if (!this.state.isExpanded && !this.props.forceExpanded) {
            // don't waste time on rendering
            return [];
        }

        const tiles: React.ReactElement[] = [];

        if (this.state.rooms) {
            let visibleRooms = this.state.rooms;
            if (!this.props.forceExpanded) {
                visibleRooms = visibleRooms.slice(0, this.numVisibleTiles);
            }

            for (const room of visibleRooms) {
                tiles.push(
                    <RoomTile
                        room={room}
                        key={`room-${room.roomId}`}
                        showMessagePreview={this.layout.showPreviews}
                        isMinimized={this.props.isMinimized}
                        tag={this.props.tagId}
                    />,
                );
            }
        }

        if (this.extraTiles) {
            // HACK: We break typing here, but this 'extra tiles' property shouldn't exist.
            (tiles as any[]).push(...this.extraTiles);
        }

        // We only have to do this because of the extra tiles. We do it conditionally
        // to avoid spending cycles on slicing. It's generally fine to do this though
        // as users are unlikely to have more than a handful of tiles when the extra
        // tiles are used.
        if (tiles.length > this.numVisibleTiles && !this.props.forceExpanded) {
            return tiles.slice(0, this.numVisibleTiles);
        }

        return tiles;
    }

    private renderMenu(): ReactNode {
        if (this.props.tagId === DefaultTagID.Suggested) return null; // not sortable

        let contextMenu: JSX.Element | undefined;
        if (this.state.contextMenuPosition) {
            const isAlphabetical = RoomListStore.instance.getTagSorting(this.props.tagId) === SortAlgorithm.Alphabetic;
            const isUnreadFirst = RoomListStore.instance.getListOrder(this.props.tagId) === ListAlgorithm.Importance;

            // Invites don't get some nonsense options, so only add them if we have to.
            let otherSections: JSX.Element | undefined;
            if (this.props.tagId !== DefaultTagID.Invite) {
                otherSections = (
                    <React.Fragment>
                        <hr />
                        <fieldset>
                            <legend className="mx_RoomSublist_contextMenu_title">{_t("common|appearance")}</legend>
                            <StyledMenuItemCheckbox
                                onClose={this.onCloseMenu}
                                onChange={this.onUnreadFirstChanged}
                                checked={isUnreadFirst}
                            >
                                {_t("room_list|sort_unread_first")}
                            </StyledMenuItemCheckbox>
                            <StyledMenuItemCheckbox
                                onClose={this.onCloseMenu}
                                onChange={this.onMessagePreviewChanged}
                                checked={this.layout.showPreviews}
                            >
                                {_t("room_list|show_previews")}
                            </StyledMenuItemCheckbox>
                        </fieldset>
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
                    <div className="mx_RoomSublist_contextMenu">
                        <fieldset>
                            <legend className="mx_RoomSublist_contextMenu_title">{_t("room_list|sort_by")}</legend>
                            <StyledMenuItemRadio
                                onClose={this.onCloseMenu}
                                onChange={() => this.onTagSortChanged(SortAlgorithm.Recent)}
                                checked={!isAlphabetical}
                                name={`mx_${this.props.tagId}_sortBy`}
                            >
                                {_t("room_list|sort_by_activity")}
                            </StyledMenuItemRadio>
                            <StyledMenuItemRadio
                                onClose={this.onCloseMenu}
                                onChange={() => this.onTagSortChanged(SortAlgorithm.Alphabetic)}
                                checked={isAlphabetical}
                                name={`mx_${this.props.tagId}_sortBy`}
                            >
                                {_t("room_list|sort_by_alphabet")}
                            </StyledMenuItemRadio>
                        </fieldset>
                        {otherSections}
                    </div>
                </ContextMenu>
            );
        }

        return (
            <React.Fragment>
                <ContextMenuTooltipButton
                    className="mx_RoomSublist_menuButton"
                    onClick={this.onOpenMenuClick}
                    title={_t("room_list|sublist_options")}
                    isExpanded={!!this.state.contextMenuPosition}
                />
                {contextMenu}
            </React.Fragment>
        );
    }

    private renderHeader(): React.ReactElement {
        return (
            <RovingTabIndexWrapper inputRef={this.headerButton}>
                {({ onFocus, isActive, ref }) => {
                    const tabIndex = isActive ? 0 : -1;

                    let ariaLabel = _t("a11y_jump_first_unread_room");
                    if (this.props.tagId === DefaultTagID.Invite) {
                        ariaLabel = _t("a11y|jump_first_invite");
                    }

                    const badge = (
                        <NotificationBadge
                            hideIfDot={true}
                            notification={this.notificationState}
                            onClick={this.onBadgeClick}
                            tabIndex={tabIndex}
                            aria-label={ariaLabel}
                            showUnsentTooltip={true}
                        />
                    );

                    let addRoomButton: JSX.Element | undefined;
                    if (this.props.AuxButtonComponent) {
                        const AuxButtonComponent = this.props.AuxButtonComponent;
                        addRoomButton = <AuxButtonComponent tabIndex={tabIndex} />;
                    }

                    const collapseClasses = classNames({
                        mx_RoomSublist_collapseBtn: true,
                        mx_RoomSublist_collapseBtn_collapsed: !this.state.isExpanded && !this.props.forceExpanded,
                    });

                    const classes = classNames({
                        mx_RoomSublist_headerContainer: true,
                        mx_RoomSublist_headerContainer_withAux: !!addRoomButton,
                    });

                    const badgeContainer = <div className="mx_RoomSublist_badgeContainer">{badge}</div>;

                    // Note: the addRoomButton conditionally gets moved around
                    // the DOM depending on whether or not the list is minimized.
                    // If we're minimized, we want it below the header so it
                    // doesn't become sticky.
                    // The same applies to the notification badge.
                    return (
                        <div
                            className={classes}
                            onKeyDown={this.onHeaderKeyDown}
                            onFocus={onFocus}
                            aria-label={this.props.label}
                            role="treeitem"
                            aria-expanded={this.state.isExpanded}
                            aria-level={1}
                            aria-selected="false"
                        >
                            <div className="mx_RoomSublist_stickableContainer">
                                <div className="mx_RoomSublist_stickable">
                                    <AccessibleButton
                                        onFocus={onFocus}
                                        ref={ref}
                                        tabIndex={tabIndex}
                                        className="mx_RoomSublist_headerText"
                                        aria-expanded={this.state.isExpanded}
                                        onClick={this.onHeaderClick}
                                        onContextMenu={this.onContextMenu}
                                        title={this.props.isMinimized ? this.props.label : undefined}
                                    >
                                        <span className={collapseClasses} />
                                        <span id={getLabelId(this.props.tagId)}>{this.props.label}</span>
                                    </AccessibleButton>
                                    {this.renderMenu()}
                                    {this.props.isMinimized ? null : badgeContainer}
                                    {this.props.isMinimized ? null : addRoomButton}
                                </div>
                            </div>
                            {this.props.isMinimized ? badgeContainer : null}
                            {this.props.isMinimized ? addRoomButton : null}
                        </div>
                    );
                }}
            </RovingTabIndexWrapper>
        );
    }

    private onScrollPrevent(e: Event): void {
        // the RoomTile calls scrollIntoView and the browser may scroll a div we do not wish to be scrollable
        // this fixes https://github.com/vector-im/element-web/issues/14413
        (e.target as HTMLDivElement).scrollTop = 0;
    }

    public render(): React.ReactElement {
        const visibleTiles = this.renderVisibleTiles();
        const hidden = !this.state.rooms.length && !this.props.extraTiles?.length && this.props.alwaysVisible !== true;
        const classes = classNames({
            mx_RoomSublist: true,
            mx_RoomSublist_hasMenuOpen: !!this.state.contextMenuPosition,
            mx_RoomSublist_minimized: this.props.isMinimized,
            mx_RoomSublist_hidden: hidden,
        });

        let content: JSX.Element | undefined;
        if (this.state.roomsLoading) {
            content = <div className="mx_RoomSublist_skeletonUI" />;
        } else if (visibleTiles.length > 0 && this.props.forceExpanded) {
            content = (
                <div className="mx_RoomSublist_resizeBox mx_RoomSublist_resizeBox_forceExpanded">
                    <div className="mx_RoomSublist_tiles" ref={this.tilesRef}>
                        {visibleTiles}
                    </div>
                </div>
            );
        } else if (visibleTiles.length > 0) {
            const layout = this.layout; // to shorten calls

            const minTiles = Math.min(layout.minVisibleTiles, this.numTiles);
            const showMoreAtMinHeight = minTiles < this.numTiles;
            const minHeightPadding = RESIZE_HANDLE_HEIGHT + (showMoreAtMinHeight ? SHOW_N_BUTTON_HEIGHT : 0);
            const minTilesPx = layout.tilesToPixelsWithPadding(minTiles, minHeightPadding);
            const maxTilesPx = layout.tilesToPixelsWithPadding(this.numTiles, this.padding);
            const showMoreBtnClasses = classNames({
                mx_RoomSublist_showNButton: true,
            });

            // If we're hiding rooms, show a 'show more' button to the user. This button
            // floats above the resize handle, if we have one present. If the user has all
            // tiles visible, it becomes 'show less'.
            let showNButton: JSX.Element | undefined;

            if (maxTilesPx > this.state.height) {
                // the height of all the tiles is greater than the section height: we need a 'show more' button
                const nonPaddedHeight = this.state.height - RESIZE_HANDLE_HEIGHT - SHOW_N_BUTTON_HEIGHT;
                const amountFullyShown = Math.floor(nonPaddedHeight / this.layout.tileHeight);
                const numMissing = this.numTiles - amountFullyShown;
                const label = _t("room_list|show_n_more", { count: numMissing });
                let showMoreText: ReactNode = <span className="mx_RoomSublist_showNButtonText">{label}</span>;
                if (this.props.isMinimized) showMoreText = null;
                showNButton = (
                    <RovingAccessibleButton
                        role="treeitem"
                        onClick={this.onShowAllClick}
                        className={showMoreBtnClasses}
                        aria-label={label}
                    >
                        <span className="mx_RoomSublist_showMoreButtonChevron mx_RoomSublist_showNButtonChevron">
                            {/* set by CSS masking */}
                        </span>
                        {showMoreText}
                    </RovingAccessibleButton>
                );
            } else if (this.numTiles > this.layout.defaultVisibleTiles) {
                // we have all tiles visible - add a button to show less
                const label = _t("room_list|show_less");
                let showLessText: ReactNode = <span className="mx_RoomSublist_showNButtonText">{label}</span>;
                if (this.props.isMinimized) showLessText = null;
                showNButton = (
                    <RovingAccessibleButton
                        role="treeitem"
                        onClick={this.onShowLessClick}
                        className={showMoreBtnClasses}
                        aria-label={label}
                    >
                        <span className="mx_RoomSublist_showLessButtonChevron mx_RoomSublist_showNButtonChevron">
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

            const handleWrapperClasses = classNames({
                mx_RoomSublist_resizerHandles: true,
                mx_RoomSublist_resizerHandles_showNButton: !!showNButton,
            });

            content = (
                <React.Fragment>
                    <Resizable
                        size={{ height: this.state.height } as any}
                        minHeight={minTilesPx}
                        maxHeight={maxTilesPx}
                        onResizeStart={this.onResizeStart}
                        onResizeStop={this.onResizeStop}
                        onResize={this.onResize}
                        handleWrapperClass={handleWrapperClasses}
                        handleClasses={{ bottom: "mx_RoomSublist_resizerHandle" }}
                        className="mx_RoomSublist_resizeBox"
                        enable={handles}
                    >
                        <div className="mx_RoomSublist_tiles" ref={this.tilesRef}>
                            {visibleTiles}
                        </div>
                        {showNButton}
                    </Resizable>
                </React.Fragment>
            );
        } else if (this.props.showSkeleton && this.state.isExpanded) {
            content = <div className="mx_RoomSublist_skeletonUI" />;
        }

        return (
            <div
                ref={this.sublistRef}
                className={classes}
                role="group"
                aria-hidden={hidden}
                aria-labelledby={getLabelId(this.props.tagId)}
                onKeyDown={this.onKeyDown}
            >
                {this.renderHeader()}
                {content}
            </div>
        );
    }
}
