/*
Copyright 2015, 2016 OpenMarket Ltd

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

import React, {createRef} from 'react';
import AccessibleButton from "../elements/AccessibleButton";
import classNames from "classnames";
import { _t } from '../../../languageHandler';
import {Key} from "../../../Keyboard";

export default class SearchBar extends React.Component {
    constructor(props) {
        super(props);

        this._search_term = createRef();

        this.state = {
            scope: 'Room',
        };
    }

    onThisRoomClick = () => {
        this.setState({ scope: 'Room' }, () => this._searchIfQuery());
    };

    onAllRoomsClick = () => {
        this.setState({ scope: 'All' }, () => this._searchIfQuery());
    };

    onSearchChange = (e) => {
        switch (e.key) {
            case Key.ENTER:
                this.onSearch();
                break;
            case Key.ESCAPE:
                this.props.onCancelClick();
                break;
        }
    };

    _searchIfQuery() {
        if (this._search_term.current.value) {
            this.onSearch();
        }
    }

    onSearch = () => {
        this.props.onSearch(this._search_term.current.value, this.state.scope);
    };

    render() {
        const searchButtonClasses = classNames("mx_SearchBar_searchButton", {
            mx_SearchBar_searching: this.props.searchInProgress,
        });
        const thisRoomClasses = classNames("mx_SearchBar_button", {
            mx_SearchBar_unselected: this.state.scope !== 'Room',
        });
        const allRoomsClasses = classNames("mx_SearchBar_button", {
            mx_SearchBar_unselected: this.state.scope !== 'All',
        });

        return (
            <div className="mx_SearchBar">
                <div className="mx_SearchBar_buttons" role="radiogroup">
                    <AccessibleButton className={ thisRoomClasses } onClick={this.onThisRoomClick} aria-checked={this.state.scope === 'Room'} role="radio">
                        {_t("This Room")}
                    </AccessibleButton>
                    <AccessibleButton className={ allRoomsClasses } onClick={this.onAllRoomsClick} aria-checked={this.state.scope === 'All'} role="radio">
                        {_t("All Rooms")}
                    </AccessibleButton>
                </div>
                <div className="mx_SearchBar_input mx_textinput">
                    <input ref={this._search_term} type="text" autoFocus={true} placeholder={_t("Search…")} onKeyDown={this.onSearchChange} />
                    <AccessibleButton className={ searchButtonClasses } onClick={this.onSearch} />
                </div>
                <AccessibleButton className="mx_SearchBar_cancel" onClick={this.props.onCancelClick} />
            </div>
        );
    }
}
