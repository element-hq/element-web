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
var MatrixClientPeg = require("../../../MatrixClientPeg");
var Modal = require("../../../Modal");
var GeminiScrollbar = require('react-gemini-scrollbar');

// A list capable of displaying entities which conform to the SearchableEntity
// interface which is an object containing getJsx(): Jsx and matches(query: string): boolean
var SearchableEntityList = React.createClass({
    displayName: 'SearchableEntityList',

    propTypes: {
        searchPlaceholderText: React.PropTypes.string,
        emptyQueryShowsAll: React.PropTypes.bool,
        showInputBox: React.PropTypes.bool,
        onQueryChanged: React.PropTypes.func, // fn(inputText)
        onSubmit: React.PropTypes.func, // fn(inputText)
        entities: React.PropTypes.array
    },

    getDefaultProps: function() {
        return {
            showInputBox: true,
            searchPlaceholderText: "Search",
            entities: [],
            emptyQueryShowsAll: false,
            onSubmit: function() {},
            onQueryChanged: function(input) {}
        };
    },

    getInitialState: function() {
        return {
            query: "",
            results: this.getSearchResults("")
        };
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
            results: this.getSearchResults(input)
        });
    },

    onQueryChanged: function(ev) {
        var q = ev.target.value;
        this.setState({
            query: q,
            results: this.getSearchResults(q)
        });
        this.props.onQueryChanged(q);
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
        var inputBox;

        if (this.props.showInputBox) {
            inputBox = (
                <form onSubmit={this.onQuerySubmit}>
                    <input className="mx_SearchableEntityList_query" type="text"
                        onChange={this.onQueryChanged} value={this.state.query}
                        placeholder={this.props.searchPlaceholderText} />
                </form>
            );
        }

        return (
            <div className={ "mx_SearchableEntityList " + (this.state.results.length ? "mx_SearchableEntityList_expanded" : "") }>
                {inputBox}
                <GeminiScrollbar className="mx_SearchableEntityList_listWrapper">
                    <div autoshow={true} className="mx_SearchableEntityList_list">
                        {this.state.results.map((entity) => {
                            return entity.getJsx();
                        })}
                    </div>
                </GeminiScrollbar>
                { this.state.results.length ? <div className="mx_SearchableEntityList_hrWrapper"><hr/></div> : '' }
            </div>
        );
    }
});

 module.exports = SearchableEntityList;
