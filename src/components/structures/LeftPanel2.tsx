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

import * as React from "react";
import { createRef } from "react";
import TagPanel from "./TagPanel";
import classNames from "classnames";
import dis from "../../dispatcher/dispatcher";
import { _t } from "../../languageHandler";
import RoomList2 from "../views/rooms/RoomList2";
import { Action } from "../../dispatcher/actions";
import UserMenu from "./UserMenu";
import RoomSearch from "./RoomSearch";
import AccessibleButton from "../views/elements/AccessibleButton";
import RoomBreadcrumbs2 from "../views/rooms/RoomBreadcrumbs2";
import { BreadcrumbsStore } from "../../stores/BreadcrumbsStore";
import { UPDATE_EVENT } from "../../stores/AsyncStore";
import ResizeNotifier from "../../utils/ResizeNotifier";
import SettingsStore from "../../settings/SettingsStore";
import RoomListStore, { LISTS_UPDATE_EVENT } from "../../stores/room-list/RoomListStore2";
import {Key} from "../../Keyboard";
import IndicatorScrollbar from "../structures/IndicatorScrollbar";

// TODO: Remove banner on launch: https://github.com/vector-im/riot-web/issues/14231
// TODO: Rename on launch: https://github.com/vector-im/riot-web/issues/14231

/*******************************************************************
 *   CAUTION                                                       *
 *******************************************************************
 * This is a work in progress implementation and isn't complete or *
 * even useful as a component. Please avoid using it until this    *
 * warning disappears.                                             *
 *******************************************************************/

interface IProps {
    isMinimized: boolean;
    resizeNotifier: ResizeNotifier;
}

interface IState {
    searchFilter: string;
    showBreadcrumbs: boolean;
    showTagPanel: boolean;
}

// List of CSS classes which should be included in keyboard navigation within the room list
const cssClasses = [
    "mx_RoomSearch_input",
    "mx_RoomSearch_icon", // minimized <RoomSearch />
    "mx_RoomSublist2_headerText",
    "mx_RoomTile2",
    "mx_RoomSublist2_showNButton",
];

export default class LeftPanel2 extends React.Component<IProps, IState> {
    private listContainerRef: React.RefObject<HTMLDivElement> = createRef();
    private tagPanelWatcherRef: string;
    private focusedElement = null;
    private isDoingStickyHeaders = false;

    constructor(props: IProps) {
        super(props);

        this.state = {
            searchFilter: "",
            showBreadcrumbs: BreadcrumbsStore.instance.visible,
            showTagPanel: SettingsStore.getValue('TagPanel.enableTagPanel'),
        };

        BreadcrumbsStore.instance.on(UPDATE_EVENT, this.onBreadcrumbsUpdate);
        RoomListStore.instance.on(LISTS_UPDATE_EVENT, this.onBreadcrumbsUpdate);
        this.tagPanelWatcherRef = SettingsStore.watchSetting("TagPanel.enableTagPanel", null, () => {
            this.setState({showTagPanel: SettingsStore.getValue("TagPanel.enableTagPanel")});
        });

        // We watch the middle panel because we don't actually get resized, the middle panel does.
        // We listen to the noisy channel to avoid choppy reaction times.
        this.props.resizeNotifier.on("middlePanelResizedNoisy", this.onResize);
    }

    public componentWillUnmount() {
        SettingsStore.unwatchSetting(this.tagPanelWatcherRef);
        BreadcrumbsStore.instance.off(UPDATE_EVENT, this.onBreadcrumbsUpdate);
        RoomListStore.instance.off(LISTS_UPDATE_EVENT, this.onBreadcrumbsUpdate);
        this.props.resizeNotifier.off("middlePanelResizedNoisy", this.onResize);
    }

    private onSearch = (term: string): void => {
        this.setState({searchFilter: term});
    };

    private onExplore = () => {
        dis.fire(Action.ViewRoomDirectory);
    };

    private onBreadcrumbsUpdate = () => {
        const newVal = BreadcrumbsStore.instance.visible;
        if (newVal !== this.state.showBreadcrumbs) {
            this.setState({showBreadcrumbs: newVal});
        }
    };

    private handleStickyHeaders(list: HTMLDivElement) {
        // TODO: Evaluate if this has any performance benefit or detriment.
        // See https://github.com/vector-im/riot-web/issues/14035

        if (this.isDoingStickyHeaders) return;
        this.isDoingStickyHeaders = true;
        if (window.requestAnimationFrame) {
            window.requestAnimationFrame(() => {
                this.doStickyHeaders(list);
                this.isDoingStickyHeaders = false;
            });
        } else {
            this.doStickyHeaders(list);
            this.isDoingStickyHeaders = false;
        }
    }

    private doStickyHeaders(list: HTMLDivElement) {
        const rlRect = list.getBoundingClientRect();
        const bottom = rlRect.bottom;
        const top = rlRect.top;
        const sublists = list.querySelectorAll<HTMLDivElement>(".mx_RoomSublist2");
        const headerHeight = 32; // Note: must match the CSS!
        const headerRightMargin = 24; // calculated from margins and widths to align with non-sticky tiles

        const headerStickyWidth = rlRect.width - headerRightMargin;

        let gotBottom = false;
        let lastTopHeader;
        for (const sublist of sublists) {
            const slRect = sublist.getBoundingClientRect();

            const header = sublist.querySelector<HTMLDivElement>(".mx_RoomSublist2_stickable");

            if (slRect.top + headerHeight > bottom && !gotBottom) {
                header.classList.add("mx_RoomSublist2_headerContainer_sticky");
                header.classList.add("mx_RoomSublist2_headerContainer_stickyBottom");
                header.style.width = `${headerStickyWidth}px`;
                header.style.removeProperty("top");
                gotBottom = true;
            } else if ((slRect.top - (headerHeight / 3)) < top) {
                header.classList.add("mx_RoomSublist2_headerContainer_sticky");
                header.classList.add("mx_RoomSublist2_headerContainer_stickyTop");
                header.style.width = `${headerStickyWidth}px`;
                header.style.top = `${rlRect.top}px`;
                if (lastTopHeader) {
                    lastTopHeader.style.display = "none";
                }
                // first unset it, if set in last iteration
                header.style.removeProperty("display");
                lastTopHeader = header;
            } else {
                header.classList.remove("mx_RoomSublist2_headerContainer_sticky");
                header.classList.remove("mx_RoomSublist2_headerContainer_stickyTop");
                header.classList.remove("mx_RoomSublist2_headerContainer_stickyBottom");
                header.style.removeProperty("width");
                header.style.removeProperty("top");
            }
        }
    }

    // TODO: Improve header reliability: https://github.com/vector-im/riot-web/issues/14232
    private onScroll = (ev: React.MouseEvent<HTMLDivElement>) => {
        const list = ev.target as HTMLDivElement;
        this.handleStickyHeaders(list);
    };

    private onResize = () => {
        if (!this.listContainerRef.current) return; // ignore: no headers to sticky
        this.handleStickyHeaders(this.listContainerRef.current);
    };

    private onFocus = (ev: React.FocusEvent) => {
        this.focusedElement = ev.target;
    };

    private onBlur = () => {
        this.focusedElement = null;
    };

    private onKeyDown = (ev: React.KeyboardEvent) => {
        if (!this.focusedElement) return;

        switch (ev.key) {
            case Key.ARROW_UP:
            case Key.ARROW_DOWN:
                ev.stopPropagation();
                ev.preventDefault();
                this.onMoveFocus(ev.key === Key.ARROW_UP);
                break;
        }
    };

    private onMoveFocus = (up: boolean) => {
        let element = this.focusedElement;

        let descending = false; // are we currently descending or ascending through the DOM tree?
        let classes: DOMTokenList;

        do {
            const child = up ? element.lastElementChild : element.firstElementChild;
            const sibling = up ? element.previousElementSibling : element.nextElementSibling;

            if (descending) {
                if (child) {
                    element = child;
                } else if (sibling) {
                    element = sibling;
                } else {
                    descending = false;
                    element = element.parentElement;
                }
            } else {
                if (sibling) {
                    element = sibling;
                    descending = true;
                } else {
                    element = element.parentElement;
                }
            }

            if (element) {
                classes = element.classList;
            }
        } while (element && !cssClasses.some(c => classes.contains(c)));

        if (element) {
            element.focus();
            this.focusedElement = element;
        }
    };

    private renderHeader(): React.ReactNode {
        let breadcrumbs;
        if (this.state.showBreadcrumbs && !this.props.isMinimized) {
            breadcrumbs = (
                <IndicatorScrollbar
                    className="mx_LeftPanel2_headerRow mx_LeftPanel2_breadcrumbsContainer mx_AutoHideScrollbar"
                    verticalScrollsHorizontally={true}
                >
                    <RoomBreadcrumbs2 />
                </IndicatorScrollbar>
            );
        }

        return (
            <div className="mx_LeftPanel2_userHeader">
                <UserMenu isMinimized={this.props.isMinimized} />
                {breadcrumbs}
            </div>
        );
    }

    private renderSearchExplore(): React.ReactNode {
        return (
            <div
                className="mx_LeftPanel2_filterContainer"
                onFocus={this.onFocus}
                onBlur={this.onBlur}
                onKeyDown={this.onKeyDown}
            >
                <RoomSearch
                    onQueryUpdate={this.onSearch}
                    isMinimized={this.props.isMinimized}
                    onVerticalArrow={this.onKeyDown}
                />
                <AccessibleButton
                    className="mx_LeftPanel2_exploreButton"
                    onClick={this.onExplore}
                    title={_t("Explore rooms")}
                />
            </div>
        );
    }

    public render(): React.ReactNode {
        const tagPanel = !this.state.showTagPanel ? null : (
            <div className="mx_LeftPanel2_tagPanelContainer">
                <TagPanel/>
            </div>
        );

        const roomList = <RoomList2
            onKeyDown={this.onKeyDown}
            resizeNotifier={null}
            collapsed={false}
            searchFilter={this.state.searchFilter}
            onFocus={this.onFocus}
            onBlur={this.onBlur}
            isMinimized={this.props.isMinimized}
            onResize={this.onResize}
        />;

        // TODO: Conference handling / calls: https://github.com/vector-im/riot-web/issues/14177

        const containerClasses = classNames({
            "mx_LeftPanel2": true,
            "mx_LeftPanel2_hasTagPanel": !!tagPanel,
            "mx_LeftPanel2_minimized": this.props.isMinimized,
        });

        const roomListClasses = classNames(
            "mx_LeftPanel2_actualRoomListContainer",
            "mx_AutoHideScrollbar",
        );

        return (
            <div className={containerClasses}>
                {tagPanel}
                <aside className="mx_LeftPanel2_roomListContainer">
                    {this.renderHeader()}
                    {this.renderSearchExplore()}
                    <div
                        className={roomListClasses}
                        onScroll={this.onScroll}
                        ref={this.listContainerRef}
                        // Firefox sometimes makes this element focusable due to
                        // overflow:scroll;, so force it out of tab order.
                        tabIndex={-1}
                    >
                        {roomList}
                    </div>
                </aside>
            </div>
        );
    }
}
