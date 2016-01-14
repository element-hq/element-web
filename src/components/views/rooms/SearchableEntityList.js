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
var React = require('react');
var classNames = require('classnames');
var MatrixClientPeg = require("../../../MatrixClientPeg");
var Modal = require("../../../Modal");
var sdk = require('../../../index');
var GeminiScrollbar = require('react-gemini-scrollbar');

// A list capable of displaying entities which conform to the SearchableEntity
// interface which is an object containing getJsx(): Jsx and matches(query: string): boolean
var SearchableEntityList = React.createClass({
    displayName: 'SearchableEntityList',

    propTypes: {
        searchPlaceholderText: React.PropTypes.string,
        emptyQueryShowsAll: React.PropTypes.bool,
        onSubmit: React.PropTypes.func, // fn(inputText)
        entities: React.PropTypes.array,
    },

    getDefaultProps: function() {
        return {
            searchPlaceholderText: "Search",
            entities: [],
            emptyQueryShowsAll: false,
            onSubmit: function() {}
        };
    },

    getInitialState: function() {
        return {
            query: "",
            results: this.getSearchResults("")
        };
    },

    onQueryChanged: function(ev) {
        var q = ev.target.value;
        this.setState({
            query: q,
            results: this.getSearchResults(q)
        });
    },

    onQuerySubmit: function(ev) {
        ev.preventDefault();
        this.props.onSubmit(this.state.query);
    },

    getSearchResults: function(query) {
        if (!query || query.length === 0) {
            return this.props.emptyQueryShowsAll ? this.props.entities : []
        }
        return this.props.entities.filter(function(e) {
            return e.matches(query);
        });
    },

    render: function() {
        return (
            <div>
                <form onSubmit={this.onQuerySubmit}>
                    <input className="mx_SearchableEntityList_query" type="text"
                        onChange={this.onQueryChanged} value={this.state.query}
                        placeholder={this.props.searchPlaceholderText} />
                </form>
                <div className="mx_SearchableEntityList_list">
                    {this.state.results.map(function(entity) {
                        return entity.getJsx();
                    })}
                </div>
            </div>
        );
    }
});

SearchableEntityList.fromRoomMembers = function(members) {
    var MemberTile = sdk.getComponent("rooms.MemberTile");
    return members.map(function(m) {
        return {
            matches: function(query) {
                return m.name.toLowerCase().indexOf(query.toLowerCase()) === 0;
            },

            getJsx: function() {
                return (
                    <MemberTile key={m.userId} member={m} />
                );
            }
        };
    });
};

SearchableEntityList.fromUsers = function(users) {
    var UserTile = sdk.getComponent("rooms.UserTile");
    return users.map(function(u) {
        return {
            matches: function(query) {
                return u.displayName.toLowerCase().indexOf(query.toLowerCase()) === 0;
            },

            getJsx: function() {
                return (
                    <UserTile key={u.userId} user={u} />
                );
            }
        };
    });
};


 module.exports = SearchableEntityList;
