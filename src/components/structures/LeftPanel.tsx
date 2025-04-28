/*
Copyright 2024 New Vector Ltd.
Copyright 2020 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX } from "react";
import { createRef } from "react";
import classNames from "classnames";

import dis from "../../dispatcher/dispatcher";
import { _t } from "../../languageHandler";
import LegacyRoomList from "../views/rooms/LegacyRoomList";
import LegacyCallHandler, { LegacyCallHandlerEvent } from "../../LegacyCallHandler";
import { HEADER_HEIGHT } from "../views/rooms/RoomSublist";
import { Action } from "../../dispatcher/actions";
import RoomSearch from "./RoomSearch";
import type ResizeNotifier from "../../utils/ResizeNotifier";
import SpaceStore from "../../stores/spaces/SpaceStore";
import { MetaSpace, type SpaceKey, UPDATE_SELECTED_SPACE } from "../../stores/spaces";
import { getKeyBindingsManager } from "../../KeyBindingsManager";
import UIStore from "../../stores/UIStore";
import { type IState as IRovingTabIndexState } from "../../accessibility/RovingTabIndex";
import LegacyRoomListHeader from "../views/rooms/LegacyRoomListHeader";
import { BreadcrumbsStore } from "../../stores/BreadcrumbsStore";
import RoomListStore, { LISTS_UPDATE_EVENT } from "../../stores/room-list/RoomListStore";
import { UPDATE_EVENT } from "../../stores/AsyncStore";
import IndicatorScrollbar from "./IndicatorScrollbar";
import RoomBreadcrumbs from "../views/rooms/RoomBreadcrumbs";
import { KeyBindingAction } from "../../accessibility/KeyboardShortcuts";
import { shouldShowComponent } from "../../customisations/helpers/UIComponents";
import { UIComponent } from "../../settings/UIFeature";
import AccessibleButton, { type ButtonEvent } from "../views/elements/AccessibleButton";
import PosthogTrackers from "../../PosthogTrackers";
import type PageType from "../../PageTypes";
import { Landmark, LandmarkNavigation } from "../../accessibility/LandmarkNavigation";
import SettingsStore from "../../settings/SettingsStore";
import { RoomListPanel } from "../views/rooms/RoomListPanel";

interface IProps {
    isMinimized: boolean;
    pageType: PageType;
    resizeNotifier: ResizeNotifier;
}

enum BreadcrumbsMode {
    Disabled,
    Legacy,
}

interface IState {
    showBreadcrumbs: BreadcrumbsMode;
    activeSpace: SpaceKey;
    supportsPstnProtocol: boolean;
}

export default class LeftPanel extends React.Component<IProps, IState> {
    private listContainerRef = createRef<HTMLDivElement>();
    private roomListRef = createRef<LegacyRoomList>();
    private focusedElement: Element | null = null;
    private isDoingStickyHeaders = false;

    public constructor(props: IProps) {
        super(props);

        this.state = {
            activeSpace: SpaceStore.instance.activeSpace,
            showBreadcrumbs: LeftPanel.breadcrumbsMode,
            supportsPstnProtocol: LegacyCallHandler.instance.getSupportsPstnProtocol(),
        };
    }

    private static get breadcrumbsMode(): BreadcrumbsMode {
        return !BreadcrumbsStore.instance.visible ? BreadcrumbsMode.Disabled : BreadcrumbsMode.Legacy;
    }

    public componentDidMount(): void {
        BreadcrumbsStore.instance.on(UPDATE_EVENT, this.onBreadcrumbsUpdate);
        RoomListStore.instance.on(LISTS_UPDATE_EVENT, this.onBreadcrumbsUpdate);
        SpaceStore.instance.on(UPDATE_SELECTED_SPACE, this.updateActiveSpace);
        LegacyCallHandler.instance.on(LegacyCallHandlerEvent.ProtocolSupport, this.updateProtocolSupport);

        if (this.listContainerRef.current) {
            UIStore.instance.trackElementDimensions("ListContainer", this.listContainerRef.current);
            // Using the passive option to not block the main thread
            // https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/addEventListener#improving_scrolling_performance_with_passive_listeners
            this.listContainerRef.current.addEventListener("scroll", this.onScroll, { passive: true });
        }
        UIStore.instance.on("ListContainer", this.refreshStickyHeaders);
    }

    public componentWillUnmount(): void {
        BreadcrumbsStore.instance.off(UPDATE_EVENT, this.onBreadcrumbsUpdate);
        RoomListStore.instance.off(LISTS_UPDATE_EVENT, this.onBreadcrumbsUpdate);
        SpaceStore.instance.off(UPDATE_SELECTED_SPACE, this.updateActiveSpace);
        LegacyCallHandler.instance.off(LegacyCallHandlerEvent.ProtocolSupport, this.updateProtocolSupport);
        UIStore.instance.stopTrackingElementDimensions("ListContainer");
        UIStore.instance.removeListener("ListContainer", this.refreshStickyHeaders);
        this.listContainerRef.current?.removeEventListener("scroll", this.onScroll);
    }

    public componentDidUpdate(prevProps: IProps, prevState: IState): void {
        if (prevState.activeSpace !== this.state.activeSpace) {
            this.refreshStickyHeaders();
        }
    }

    private updateProtocolSupport = (): void => {
        this.setState({ supportsPstnProtocol: LegacyCallHandler.instance.getSupportsPstnProtocol() });
    };

    private updateActiveSpace = (activeSpace: SpaceKey): void => {
        this.setState({ activeSpace });
    };

    private onDialPad = (): void => {
        dis.fire(Action.OpenDialPad);
    };

    private onExplore = (ev: ButtonEvent): void => {
        dis.fire(Action.ViewRoomDirectory);
        PosthogTrackers.trackInteraction("WebLeftPanelExploreRoomsButton", ev);
    };

    private refreshStickyHeaders = (): void => {
        if (!this.listContainerRef.current) return; // ignore: no headers to sticky
        this.handleStickyHeaders(this.listContainerRef.current);
    };

    private onBreadcrumbsUpdate = (): void => {
        const newVal = LeftPanel.breadcrumbsMode;
        if (newVal !== this.state.showBreadcrumbs) {
            this.setState({ showBreadcrumbs: newVal });

            // Update the sticky headers too as the breadcrumbs will be popping in or out.
            if (!this.listContainerRef.current) return; // ignore: no headers to sticky
            this.handleStickyHeaders(this.listContainerRef.current);
        }
    };

    private handleStickyHeaders(list: HTMLDivElement): void {
        if (this.isDoingStickyHeaders) return;
        this.isDoingStickyHeaders = true;
        window.requestAnimationFrame(() => {
            this.doStickyHeaders(list);
            this.isDoingStickyHeaders = false;
        });
    }

    private doStickyHeaders(list: HTMLDivElement): void {
        if (!list.parentElement) return;
        const topEdge = list.scrollTop;
        const bottomEdge = list.offsetHeight + list.scrollTop;
        const sublists = list.querySelectorAll<HTMLDivElement>(".mx_RoomSublist:not(.mx_RoomSublist_hidden)");

        // We track which styles we want on a target before making the changes to avoid
        // excessive layout updates.
        const targetStyles = new Map<
            HTMLDivElement,
            {
                stickyTop?: boolean;
                stickyBottom?: boolean;
                makeInvisible?: boolean;
            }
        >();

        let lastTopHeader: HTMLDivElement | undefined;
        let firstBottomHeader: HTMLDivElement | undefined;
        for (const sublist of sublists) {
            const header = sublist.querySelector<HTMLDivElement>(".mx_RoomSublist_stickable");
            if (!header) continue; // this should never occur
            header.style.removeProperty("display"); // always clear display:none first

            // When an element is <=40% off screen, make it take over
            const offScreenFactor = 0.4;
            const isOffTop = sublist.offsetTop + offScreenFactor * HEADER_HEIGHT <= topEdge;
            const isOffBottom = sublist.offsetTop + offScreenFactor * HEADER_HEIGHT >= bottomEdge;

            if (isOffTop || sublist === sublists[0]) {
                targetStyles.set(header, { stickyTop: true });
                if (lastTopHeader) {
                    lastTopHeader.style.display = "none";
                    targetStyles.set(lastTopHeader, { makeInvisible: true });
                }
                lastTopHeader = header;
            } else if (isOffBottom && !firstBottomHeader) {
                targetStyles.set(header, { stickyBottom: true });
                firstBottomHeader = header;
            } else {
                targetStyles.set(header, {}); // nothing == clear
            }
        }

        // Run over the style changes and make them reality. We check to see if we're about to
        // cause a no-op update, as adding/removing properties that are/aren't there cause
        // layout updates.
        for (const header of targetStyles.keys()) {
            const style = targetStyles.get(header)!;

            if (style.makeInvisible) {
                // we will have already removed the 'display: none', so add it back.
                header.style.display = "none";
                continue; // nothing else to do, even if sticky somehow
            }

            if (style.stickyTop) {
                if (!header.classList.contains("mx_RoomSublist_headerContainer_stickyTop")) {
                    header.classList.add("mx_RoomSublist_headerContainer_stickyTop");
                }

                const newTop = `${list.parentElement.offsetTop}px`;
                if (header.style.top !== newTop) {
                    header.style.top = newTop;
                }
            } else {
                if (header.classList.contains("mx_RoomSublist_headerContainer_stickyTop")) {
                    header.classList.remove("mx_RoomSublist_headerContainer_stickyTop");
                }
                if (header.style.top) {
                    header.style.removeProperty("top");
                }
            }

            if (style.stickyBottom) {
                if (!header.classList.contains("mx_RoomSublist_headerContainer_stickyBottom")) {
                    header.classList.add("mx_RoomSublist_headerContainer_stickyBottom");
                }

                const offset =
                    UIStore.instance.windowHeight - (list.parentElement.offsetTop + list.parentElement.offsetHeight);
                const newBottom = `${offset}px`;
                if (header.style.bottom !== newBottom) {
                    header.style.bottom = newBottom;
                }
            } else {
                if (header.classList.contains("mx_RoomSublist_headerContainer_stickyBottom")) {
                    header.classList.remove("mx_RoomSublist_headerContainer_stickyBottom");
                }
                if (header.style.bottom) {
                    header.style.removeProperty("bottom");
                }
            }

            if (style.stickyTop || style.stickyBottom) {
                if (!header.classList.contains("mx_RoomSublist_headerContainer_sticky")) {
                    header.classList.add("mx_RoomSublist_headerContainer_sticky");
                }

                const listDimensions = UIStore.instance.getElementDimensions("ListContainer");
                if (listDimensions) {
                    const headerRightMargin = 15; // calculated from margins and widths to align with non-sticky tiles
                    const headerStickyWidth = listDimensions.width - headerRightMargin;
                    const newWidth = `${headerStickyWidth}px`;
                    if (header.style.width !== newWidth) {
                        header.style.width = newWidth;
                    }
                }
            } else if (!style.stickyTop && !style.stickyBottom) {
                if (header.classList.contains("mx_RoomSublist_headerContainer_sticky")) {
                    header.classList.remove("mx_RoomSublist_headerContainer_sticky");
                }

                if (header.style.width) {
                    header.style.removeProperty("width");
                }
            }
        }

        // add appropriate sticky classes to wrapper so it has
        // the necessary top/bottom padding to put the sticky header in
        const listWrapper = list.parentElement; // .mx_LeftPanel_roomListWrapper
        if (!listWrapper) return;
        if (lastTopHeader) {
            listWrapper.classList.add("mx_LeftPanel_roomListWrapper_stickyTop");
        } else {
            listWrapper.classList.remove("mx_LeftPanel_roomListWrapper_stickyTop");
        }
        if (firstBottomHeader) {
            listWrapper.classList.add("mx_LeftPanel_roomListWrapper_stickyBottom");
        } else {
            listWrapper.classList.remove("mx_LeftPanel_roomListWrapper_stickyBottom");
        }
    }

    private onScroll = (ev: Event): void => {
        const list = ev.target as HTMLDivElement;
        this.handleStickyHeaders(list);
    };

    private onFocus = (ev: React.FocusEvent): void => {
        this.focusedElement = ev.target;
    };

    private onBlur = (): void => {
        this.focusedElement = null;
    };

    private onKeyDown = (ev: React.KeyboardEvent, state?: IRovingTabIndexState): void => {
        if (!this.focusedElement) return;

        const action = getKeyBindingsManager().getRoomListAction(ev);
        switch (action) {
            case KeyBindingAction.NextRoom:
                if (!state) {
                    ev.stopPropagation();
                    ev.preventDefault();
                    this.roomListRef.current?.focus();
                }
                break;
        }

        const navAction = getKeyBindingsManager().getNavigationAction(ev);
        if (navAction === KeyBindingAction.PreviousLandmark || navAction === KeyBindingAction.NextLandmark) {
            ev.stopPropagation();
            ev.preventDefault();
            LandmarkNavigation.findAndFocusNextLandmark(
                Landmark.ROOM_SEARCH,
                navAction === KeyBindingAction.PreviousLandmark,
            );
        }
    };

    private renderBreadcrumbs(): React.ReactNode {
        if (this.state.showBreadcrumbs === BreadcrumbsMode.Legacy && !this.props.isMinimized) {
            return (
                <IndicatorScrollbar
                    role="navigation"
                    aria-label={_t("a11y|recent_rooms")}
                    className="mx_LeftPanel_breadcrumbsContainer mx_AutoHideScrollbar"
                    verticalScrollsHorizontally={true}
                >
                    <RoomBreadcrumbs />
                </IndicatorScrollbar>
            );
        }
    }

    private renderSearchDialExplore(): React.ReactNode {
        let dialPadButton: JSX.Element | undefined;

        // If we have dialer support, show a button to bring up the dial pad to start a new call
        if (this.state.supportsPstnProtocol) {
            dialPadButton = (
                <AccessibleButton
                    className={classNames("mx_LeftPanel_dialPadButton", {})}
                    onClick={this.onDialPad}
                    title={_t("left_panel|open_dial_pad")}
                />
            );
        }

        let rightButton: JSX.Element | undefined;
        if (this.state.activeSpace === MetaSpace.Home && shouldShowComponent(UIComponent.ExploreRooms)) {
            rightButton = (
                <AccessibleButton
                    className="mx_LeftPanel_exploreButton"
                    onClick={this.onExplore}
                    title={_t("action|explore_rooms")}
                />
            );
        }

        return (
            <div
                className="mx_LeftPanel_filterContainer"
                onFocus={this.onFocus}
                onBlur={this.onBlur}
                onKeyDown={this.onKeyDown}
                role="search"
            >
                <RoomSearch isMinimized={this.props.isMinimized} />

                {dialPadButton}
                {rightButton}
            </div>
        );
    }

    public render(): React.ReactNode {
        const containerClasses = classNames({
            mx_LeftPanel: true,
            mx_LeftPanel_minimized: this.props.isMinimized,
        });

        const roomListClasses = classNames("mx_LeftPanel_actualRoomListContainer", "mx_AutoHideScrollbar");
        const useNewRoomList = SettingsStore.getValue("feature_new_room_list");
        if (useNewRoomList) {
            return (
                <div className={containerClasses}>
                    <div className="mx_LeftPanel_roomListContainer">
                        <RoomListPanel activeSpace={this.state.activeSpace} />
                    </div>
                </div>
            );
        }

        const roomList = (
            <LegacyRoomList
                onKeyDown={this.onKeyDown}
                resizeNotifier={this.props.resizeNotifier}
                onFocus={this.onFocus}
                onBlur={this.onBlur}
                isMinimized={this.props.isMinimized}
                activeSpace={this.state.activeSpace}
                onResize={this.refreshStickyHeaders}
                onListCollapse={this.refreshStickyHeaders}
                ref={this.roomListRef}
            />
        );

        return (
            <div className={containerClasses}>
                <div className="mx_LeftPanel_roomListContainer">
                    {shouldShowComponent(UIComponent.FilterContainer) && this.renderSearchDialExplore()}
                    {this.renderBreadcrumbs()}
                    {!this.props.isMinimized && <LegacyRoomListHeader onVisibilityChange={this.refreshStickyHeaders} />}
                    <nav className="mx_LeftPanel_roomListWrapper" aria-label={_t("common|rooms")}>
                        <div
                            className={roomListClasses}
                            ref={this.listContainerRef}
                            // Firefox sometimes makes this element focusable due to
                            // overflow:scroll;, so force it out of tab order.
                            tabIndex={-1}
                        >
                            {roomList}
                        </div>
                    </nav>
                </div>
            </div>
        );
    }
}
