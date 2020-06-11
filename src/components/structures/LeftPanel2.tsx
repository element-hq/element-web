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
import TagPanel from "./TagPanel";
import classNames from "classnames";
import dis from "../../dispatcher/dispatcher";
import { _t } from "../../languageHandler";
import SearchBox from "./SearchBox";
import RoomList2 from "../views/rooms/RoomList2";
import { Action } from "../../dispatcher/actions";
import { MatrixClientPeg } from "../../MatrixClientPeg";
import BaseAvatar from '../views/avatars/BaseAvatar';
import UserMenuButton from "./UserMenuButton";
import RoomSearch from "./RoomSearch";
import AccessibleButton from "../views/elements/AccessibleButton";
import RoomBreadcrumbs2 from "../views/rooms/RoomBreadcrumbs2";
import { BreadcrumbsStore } from "../../stores/BreadcrumbsStore";
import { UPDATE_EVENT } from "../../stores/AsyncStore";

/*******************************************************************
 *   CAUTION                                                       *
 *******************************************************************
 * This is a work in progress implementation and isn't complete or *
 * even useful as a component. Please avoid using it until this    *
 * warning disappears.                                             *
 *******************************************************************/

interface IProps {
    isMinimized: boolean;
}

interface IState {
    searchFilter: string; // TODO: Move search into room list?
    showBreadcrumbs: boolean;
}

export default class LeftPanel2 extends React.Component<IProps, IState> {
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
        };

        BreadcrumbsStore.instance.on(UPDATE_EVENT, this.onBreadcrumbsUpdate);
    }

    public componentWillUnmount() {
        BreadcrumbsStore.instance.off(UPDATE_EVENT, this.onBreadcrumbsUpdate);
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

    private renderHeader(): React.ReactNode {
        // TODO: Update when profile info changes
        // TODO: Presence
        // TODO: Breadcrumbs toggle
        // TODO: Menu button
        const avatarSize = 32;
        // TODO: Don't do this profile lookup in render()
        const client = MatrixClientPeg.get();
        let displayName = client.getUserId();
        let avatarUrl: string = null;
        const myUser = client.getUser(client.getUserId());
        if (myUser) {
            displayName = myUser.rawDisplayName;
            avatarUrl = myUser.avatarUrl;
        }

        let breadcrumbs;
        if (this.state.showBreadcrumbs) {
            breadcrumbs = (
                <div className="mx_LeftPanel2_headerRow mx_LeftPanel2_breadcrumbsContainer">
                    {this.props.isMinimized ? null : <RoomBreadcrumbs2 />}
                </div>
            );
        }

        let name = <span className="mx_LeftPanel2_userName">{displayName}</span>;
        let buttons = (
            <span className="mx_LeftPanel2_headerButtons">
                <UserMenuButton />
            </span>
        );
        if (this.props.isMinimized) {
            name = null;
            buttons = null;
        }

        return (
            <div className="mx_LeftPanel2_userHeader">
                <div className="mx_LeftPanel2_headerRow">
                    <span className="mx_LeftPanel2_userAvatarContainer">
                        <BaseAvatar
                            idName={MatrixClientPeg.get().getUserId()}
                            name={displayName}
                            url={avatarUrl}
                            width={avatarSize}
                            height={avatarSize}
                            resizeMethod="crop"
                            className="mx_LeftPanel2_userAvatar"
                        />
                    </span>
                    {name}
                    {buttons}
                </div>
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
        const tagPanel = (
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
            "mx_LeftPanel2_minimized": this.props.isMinimized,
        });

        return (
            <div className={containerClasses}>
                {tagPanel}
                <aside className="mx_LeftPanel2_roomListContainer">
                    {this.renderHeader()}
                    {this.renderSearchExplore()}
                    <div className="mx_LeftPanel2_actualRoomListContainer">
                        {roomList}
                    </div>
                </aside>
            </div>
        );
    }
}
