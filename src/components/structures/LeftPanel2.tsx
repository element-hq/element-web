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
    searchFilter: string; // TODO: Move search into room list?
    showBreadcrumbs: boolean;
    showTagPanel: boolean;
}

export default class LeftPanel2 extends React.Component<IProps, IState> {
    private listContainerRef: React.RefObject<HTMLDivElement> = createRef();
    private tagPanelWatcherRef: string;

    // TODO: Properly support TagPanel
    // TODO: Properly support searching/filtering
    // TODO: Properly support breadcrumbs
    // TODO: a11y
    // TODO: actually make this useful in general (match design proposals)
    // TODO: Fadable support (is this still needed?)

    constructor(props: IProps) {
        super(props);

        this.state = {
            searchFilter: "",
            showBreadcrumbs: BreadcrumbsStore.instance.visible,
            showTagPanel: SettingsStore.getValue('TagPanel.enableTagPanel'),
        };

        BreadcrumbsStore.instance.on(UPDATE_EVENT, this.onBreadcrumbsUpdate);
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
        const rlRect = list.getBoundingClientRect();
        const bottom = rlRect.bottom;
        const top = rlRect.top;
        const sublists = list.querySelectorAll<HTMLDivElement>(".mx_RoomSublist2");
        const headerHeight = 32; // Note: must match the CSS!
        const headerRightMargin = 24; // calculated from margins and widths to align with non-sticky tiles

        const headerStickyWidth = rlRect.width - headerRightMargin;

        let gotBottom = false;
        for (const sublist of sublists) {
            const slRect = sublist.getBoundingClientRect();

            const header = sublist.querySelector<HTMLDivElement>(".mx_RoomSublist2_stickable");

            if (slRect.top + headerHeight > bottom && !gotBottom) {
                header.classList.add("mx_RoomSublist2_headerContainer_sticky");
                header.classList.add("mx_RoomSublist2_headerContainer_stickyBottom");
                header.style.width = `${headerStickyWidth}px`;
                header.style.top = `unset`;
                gotBottom = true;
            } else if (slRect.top < top) {
                header.classList.add("mx_RoomSublist2_headerContainer_sticky");
                header.classList.add("mx_RoomSublist2_headerContainer_stickyTop");
                header.style.width = `${headerStickyWidth}px`;
                header.style.top = `${rlRect.top}px`;
            } else {
                header.classList.remove("mx_RoomSublist2_headerContainer_sticky");
                header.classList.remove("mx_RoomSublist2_headerContainer_stickyTop");
                header.classList.remove("mx_RoomSublist2_headerContainer_stickyBottom");
                header.style.width = `unset`;
                header.style.top = `unset`;
            }
        }
    }

    // TODO: Apply this on resize, init, etc for reliability
    private onScroll = (ev: React.MouseEvent<HTMLDivElement>) => {
        const list = ev.target as HTMLDivElement;
        this.handleStickyHeaders(list);
    };

    private onResize = () => {
        if (!this.listContainerRef.current) return; // ignore: no headers to sticky
        this.handleStickyHeaders(this.listContainerRef.current);
    };

    private renderHeader(): React.ReactNode {
        // TODO: Update when profile info changes
        // TODO: Presence
        // TODO: Breadcrumbs toggle
        // TODO: Menu button

        let breadcrumbs;
        if (this.state.showBreadcrumbs) {
            breadcrumbs = (
                <div className="mx_LeftPanel2_headerRow mx_LeftPanel2_breadcrumbsContainer">
                    {this.props.isMinimized ? null : <RoomBreadcrumbs2 />}
                </div>
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
        // TODO: Collapsed support

        return (
            <div className="mx_LeftPanel2_filterContainer">
                <RoomSearch onQueryUpdate={this.onSearch} isMinimized={this.props.isMinimized} />
                <AccessibleButton
                    tabIndex={-1}
                    className='mx_LeftPanel2_exploreButton'
                    onClick={this.onExplore}
                    alt={_t("Explore rooms")}
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

        // TODO: Improve props for RoomList2
        const roomList = <RoomList2
            onKeyDown={() => {/*TODO*/}}
            resizeNotifier={null}
            collapsed={false}
            searchFilter={this.state.searchFilter}
            onFocus={() => {/*TODO*/}}
            onBlur={() => {/*TODO*/}}
            isMinimized={this.props.isMinimized}
        />;

        // TODO: Conference handling / calls

        const containerClasses = classNames({
            "mx_LeftPanel2": true,
            "mx_LeftPanel2_hasTagPanel": !!tagPanel,
            "mx_LeftPanel2_minimized": this.props.isMinimized,
        });

        return (
            <div className={containerClasses}>
                {tagPanel}
                <aside className="mx_LeftPanel2_roomListContainer">
                    {this.renderHeader()}
                    {this.renderSearchExplore()}
                    <div
                        className="mx_LeftPanel2_actualRoomListContainer"
                        onScroll={this.onScroll}
                        ref={this.listContainerRef}
                    >{roomList}</div>
                </aside>
            </div>
        );
    }
}
