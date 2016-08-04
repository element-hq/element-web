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

'use strict';

var React = require('react');
var MatrixClientPeg = require("../../../MatrixClientPeg");
var CommandEntry = require("../../../TabCompleteEntries").CommandEntry;

module.exports = React.createClass({
    displayName: 'TabCompleteBar',

    propTypes: {
        tabComplete: React.PropTypes.object.isRequired
    },

    render: function() {
        return (
            <div className="mx_TabCompleteBar">
            {this.props.tabComplete.peek(6).map((entry, i) => {
                return (
                    <div key={entry.getKey() || i + ""}
                         className={ "mx_TabCompleteBar_item " + (entry instanceof CommandEntry ? "mx_TabCompleteBar_command" : "") }
                         onClick={this.props.tabComplete.onEntryClick.bind(this.props.tabComplete, entry)} >
                        {entry.getImageJsx()}
                        <span className="mx_TabCompleteBar_text">
                            {entry.getText()}
                        </span>
                    </div>
                );
            })}
            </div>
        );
    }
});
