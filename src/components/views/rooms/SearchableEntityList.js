/*
Copyright 2015, 2016 OpenMarket Ltd
Copyright 2019 The Matrix.org Foundation C.I.C.

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

import React from 'react';
import PropTypes from 'prop-types';
import createReactClass from 'create-react-class';
import * as sdk from "../../../index";
import { _t } from '../../../languageHandler';

// A list capable of displaying entities which conform to the SearchableEntity
// interface which is an object containing getJsx(): Jsx and matches(query: string): boolean
const SearchableEntityList = createReactClass({
    displayName: 'SearchableEntityList',

    propTypes: {
        emptyQueryShowsAll: PropTypes.bool,
        showInputBox: PropTypes.bool,
        onQueryChanged: PropTypes.func, // fn(inputText)
        onSubmit: PropTypes.func, // fn(inputText)
        entities: PropTypes.array,
        truncateAt: PropTypes.number,
    },

    getDefaultProps: function() {
        return {
            showInputBox: true,
            entities: [],
            emptyQueryShowsAll: false,
            onSubmit: function() {},
            onQueryChanged: function(input) {},
        };
    },

    getInitialState: function() {
        return {
            query: "",
            focused: false,
            truncateAt: this.props.truncateAt,
            results: this.getSearchResults("", this.props.entities),
        };
    },

    componentWillReceiveProps: function(newProps) {
        // recalculate the search results in case we got new entities
        this.setState({
            results: this.getSearchResults(this.state.query, newProps.entities),
        });
    },

    componentWillUnmount: function() {
        // pretend the query box was blanked out else filters could still be
        // applied to other components which rely on onQueryChanged.
        this.props.onQueryChanged("");
    },

    /**
     * Public-facing method to set the input query text to the given input.
     * @param {string} input
     */
    setQuery: function(input) {
        this.setState({
            query: input,
            results: this.getSearchResults(input, this.props.entities),
        });
    },

    onQueryChanged: function(ev) {
        const q = ev.target.value;
        this.setState({
            query: q,
            // reset truncation if they back out the entire text
            truncateAt: (q.length === 0 ? this.props.truncateAt : this.state.truncateAt),
            results: this.getSearchResults(q, this.props.entities),
        }, () => {
            // invoke the callback AFTER we've flushed the new state. We need to
            // do this because onQueryChanged can result in new props being passed
            // to this component, which will then try to recalculate the search
            // list. If we do this without flushing, we'll recalc with the last
            // search term and not the current one!
            this.props.onQueryChanged(q);
        });
    },

    onQuerySubmit: function(ev) {
        ev.preventDefault();
        this.props.onSubmit(this.state.query);
    },

    getSearchResults: function(query, entities) {
        if (!query || query.length === 0) {
            return this.props.emptyQueryShowsAll ? entities : [];
        }
        return entities.filter(function(e) {
            return e.matches(query);
        });
    },

    _showAll: function() {
        this.setState({
            truncateAt: -1,
        });
    },

    _createOverflowEntity: function(overflowCount, totalCount) {
        const EntityTile = sdk.getComponent("rooms.EntityTile");
        const BaseAvatar = sdk.getComponent("avatars.BaseAvatar");
        const text = _t("and %(count)s others...", { count: overflowCount });
        return (
            <EntityTile className="mx_EntityTile_ellipsis" avatarJsx={
                <BaseAvatar url={require("../../../../res/img/ellipsis.svg")} name="..." width={36} height={36} />
            } name={text} presenceState="online" suppressOnHover={true}
            onClick={this._showAll} />
        );
    },

    render: function() {
        let inputBox;

        if (this.props.showInputBox) {
            inputBox = (
                <form onSubmit={this.onQuerySubmit} autoComplete="off">
                    <input className="mx_SearchableEntityList_query" id="mx_SearchableEntityList_query" type="text"
                        onChange={this.onQueryChanged} value={this.state.query}
                        onFocus= {() => { this.setState({ focused: true }); }}
                        onBlur= {() => { this.setState({ focused: false }); }}
                        placeholder={_t("Search")} />
                </form>
            );
        }

        let list;
        if (this.state.results.length > 1 || this.state.focused) {
            if (this.props.truncateAt) { // caller wants list truncated
                const TruncatedList = sdk.getComponent("elements.TruncatedList");
                list = (
                    <TruncatedList className="mx_SearchableEntityList_list"
                            truncateAt={this.state.truncateAt} // use state truncation as it may be expanded
                            createOverflowElement={this._createOverflowEntity}>
                        { this.state.results.map((entity) => {
                            return entity.getJsx();
                        }) }
                    </TruncatedList>
                );
            } else {
                list = (
                    <div className="mx_SearchableEntityList_list">
                        { this.state.results.map((entity) => {
                            return entity.getJsx();
                        }) }
                    </div>
                );
            }
            const GeminiScrollbarWrapper = sdk.getComponent("elements.GeminiScrollbarWrapper");
            list = (
                <GeminiScrollbarWrapper autoshow={true}
                                 className="mx_SearchableEntityList_listWrapper">
                    { list }
                </GeminiScrollbarWrapper>
            );
        }

        return (
            <div className={"mx_SearchableEntityList " + (list ? "mx_SearchableEntityList_expanded" : "")}>
                { inputBox }
                { list }
                { list ? <div className="mx_SearchableEntityList_hrWrapper"><hr /></div> : '' }
            </div>
        );
    },
});

export default SearchableEntityList;
