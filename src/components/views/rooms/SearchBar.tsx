/*
Copyright 2015, 2016 OpenMarket Ltd
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

import React, { createRef, RefObject } from "react";
import classNames from "classnames";

import AccessibleButton from "../elements/AccessibleButton";
import { _t } from "../../../languageHandler";
import { PosthogScreenTracker } from "../../../PosthogTrackers";
import { getKeyBindingsManager } from "../../../KeyBindingsManager";
import { KeyBindingAction } from "../../../accessibility/KeyboardShortcuts";
import SearchWarning, { WarningKind } from "../elements/SearchWarning";

interface IProps {
    onCancelClick: () => void;
    onSearch: (query: string, scope: SearchScope) => void;
    searchInProgress?: boolean;
    isRoomEncrypted?: boolean;
}

interface IState {
    scope: SearchScope;
}

export enum SearchScope {
    Room = "Room",
    All = "All",
}

export default class SearchBar extends React.Component<IProps, IState> {
    private searchTerm: RefObject<HTMLInputElement> = createRef();

    public constructor(props: IProps) {
        super(props);
        this.state = {
            scope: SearchScope.Room,
        };
    }

    private onThisRoomClick = (): void => {
        this.setState({ scope: SearchScope.Room }, () => this.searchIfQuery());
    };

    private onAllRoomsClick = (): void => {
        this.setState({ scope: SearchScope.All }, () => this.searchIfQuery());
    };

    private onSearchChange = (e: React.KeyboardEvent): void => {
        const action = getKeyBindingsManager().getAccessibilityAction(e);
        switch (action) {
            case KeyBindingAction.Enter:
                this.onSearch();
                break;
            case KeyBindingAction.Escape:
                this.props.onCancelClick();
                break;
        }
    };

    private searchIfQuery(): void {
        if (this.searchTerm.current?.value) {
            this.onSearch();
        }
    }

    private onSearch = (): void => {
        if (!this.searchTerm.current?.value.trim()) return;
        this.props.onSearch(this.searchTerm.current.value, this.state.scope);
    };

    public render(): React.ReactNode {
        const searchButtonClasses = classNames("mx_SearchBar_searchButton", {
            mx_SearchBar_searching: this.props.searchInProgress,
        });
        const thisRoomClasses = classNames("mx_SearchBar_button", {
            mx_SearchBar_unselected: this.state.scope !== SearchScope.Room,
        });
        const allRoomsClasses = classNames("mx_SearchBar_button", {
            mx_SearchBar_unselected: this.state.scope !== SearchScope.All,
        });

        return (
            <>
                <PosthogScreenTracker screenName="RoomSearch" />
                <div className="mx_SearchBar">
                    <div className="mx_SearchBar_buttons" role="radiogroup">
                        <AccessibleButton
                            className={thisRoomClasses}
                            onClick={this.onThisRoomClick}
                            aria-checked={this.state.scope === SearchScope.Room}
                            role="radio"
                        >
                            {_t("This Room")}
                        </AccessibleButton>
                        <AccessibleButton
                            className={allRoomsClasses}
                            onClick={this.onAllRoomsClick}
                            aria-checked={this.state.scope === SearchScope.All}
                            role="radio"
                        >
                            {_t("All Rooms")}
                        </AccessibleButton>
                    </div>
                    <div className="mx_SearchBar_input mx_textinput">
                        <input
                            ref={this.searchTerm}
                            type="text"
                            autoFocus={true}
                            placeholder={_t("Search…")}
                            aria-label={
                                this.state.scope === SearchScope.Room ? _t("Search this room") : _t("Search all rooms")
                            }
                            onKeyDown={this.onSearchChange}
                        />
                        <AccessibleButton
                            className={searchButtonClasses}
                            onClick={this.onSearch}
                            aria-label={_t("Search")}
                        />
                    </div>
                    <AccessibleButton
                        className="mx_SearchBar_cancel"
                        onClick={this.props.onCancelClick}
                        aria-label={_t("Cancel")}
                    />
                </div>
                <SearchWarning isRoomEncrypted={this.props.isRoomEncrypted} kind={WarningKind.Search} />
            </>
        );
    }
}
