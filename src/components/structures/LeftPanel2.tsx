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
import AccessibleButton from "../views/elements/AccessibleButton";
import { _t } from "../../languageHandler";
import SearchBox from "./SearchBox";
import RoomList2 from "../views/rooms/RoomList2";
import TopLeftMenuButton from "./TopLeftMenuButton";
import { Action } from "../../dispatcher/actions";

/*******************************************************************
 *   CAUTION                                                       *
 *******************************************************************
 * This is a work in progress implementation and isn't complete or *
 * even useful as a component. Please avoid using it until this    *
 * warning disappears.                                             *
 *******************************************************************/

interface IProps {
    // TODO: Support collapsed state
}

interface IState {
    searchExpanded: boolean;
    searchFilter: string; // TODO: Move search into room list?
}

export default class LeftPanel2 extends React.Component<IProps, IState> {
    // TODO: Properly support TagPanel
    // TODO: Properly support searching/filtering
    // TODO: Properly support breadcrumbs
    // TODO: Properly support TopLeftMenu (User Settings)
    // TODO: a11y
    // TODO: actually make this useful in general (match design proposals)
    // TODO: Fadable support (is this still needed?)

    constructor(props: IProps) {
        super(props);

        this.state = {
            searchExpanded: false,
            searchFilter: "",
        };
    }

    private onSearch = (term: string): void => {
        this.setState({searchFilter: term});
    };

    private onSearchCleared = (source: string): void => {
        if (source === "keyboard") {
            dis.fire(Action.FocusComposer);
        }
        this.setState({searchExpanded: false});
    }

    private onSearchFocus = (): void => {
        this.setState({searchExpanded: true});
    };

    private onSearchBlur = (event: FocusEvent): void => {
        const target = event.target as HTMLInputElement;
        if (target.value.length === 0) {
            this.setState({searchExpanded: false});
        }
    }

    public render(): React.ReactNode {
        const tagPanel = (
            <div className="mx_LeftPanel_tagPanelContainer">
                <TagPanel/>
            </div>
        );

        const exploreButton = (
            <div
                className={classNames("mx_LeftPanel_explore", {"mx_LeftPanel_explore_hidden": this.state.searchExpanded})}>
                <AccessibleButton onClick={() => dis.dispatch({action: 'view_room_directory'})}>
                    {_t("Explore")}
                </AccessibleButton>
            </div>
        );

        const searchBox = (<SearchBox
            className="mx_LeftPanel_filterRooms"
            enableRoomSearchFocus={true}
            blurredPlaceholder={_t('Filter')}
            placeholder={_t('Filter rooms…')}
            onKeyDown={() => {/*TODO*/}}
            onSearch={this.onSearch}
            onCleared={this.onSearchCleared}
            onFocus={this.onSearchFocus}
            onBlur={this.onSearchBlur}
            collapsed={false}/>); // TODO: Collapsed support

        // TODO: Improve props for RoomList2
        const roomList = <RoomList2
            onKeyDown={() => {/*TODO*/}}
            resizeNotifier={null}
            collapsed={false}
            searchFilter={this.state.searchFilter}
            onFocus={() => {/*TODO*/}}
            onBlur={() => {/*TODO*/}}
        />;

        // TODO: Breadcrumbs
        // TODO: Conference handling / calls

        const containerClasses = classNames({
            "mx_LeftPanel_container": true,
            "mx_fadable": true,
            "collapsed": false, // TODO: Collapsed support
            "mx_LeftPanel_container_hasTagPanel": true, // TODO: TagPanel support
            "mx_fadable_faded": false,
            "mx_LeftPanel2": true, // TODO: Remove flag when RoomList2 ships (used as an indicator)
        });

        return (
            <div className={containerClasses}>
                {tagPanel}
                <aside className="mx_LeftPanel dark-panel">
                    <TopLeftMenuButton collapsed={false}/>
                    <div
                        className="mx_LeftPanel_exploreAndFilterRow"
                        onKeyDown={() => {/*TODO*/}}
                        onFocus={() => {/*TODO*/}}
                        onBlur={() => {/*TODO*/}}
                    >
                        {exploreButton}
                        {searchBox}
                    </div>
                    {roomList}
                </aside>
            </div>
        );
    }
}
