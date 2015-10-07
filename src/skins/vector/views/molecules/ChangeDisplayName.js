/*
Copyright 2015 OpenMarket Ltd

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
var sdk = require('matrix-react-sdk');

var ChangeDisplayNameController = require("matrix-react-sdk/lib/controllers/molecules/ChangeDisplayName");
var Loader = require("react-loader");


module.exports = React.createClass({
    displayName: 'ChangeDisplayName',
    mixins: [ChangeDisplayNameController],

    edit: function() {
        this.refs.displayname_edit.edit()
    },

    onValueChanged: function(new_value, shouldSubmit) {
        if (shouldSubmit) {
            this.changeDisplayname(new_value);
        }
    },

    render: function() {
        if (this.state.busy) {
            return (
                <Loader />
            );
        } else if (this.state.errorString) {
            return (
                <div className="error">{this.state.errorString}</div>
            );
        } else {
            var EditableText = sdk.getComponent('atoms.EditableText');
            return (
                <EditableText ref="displayname_edit" initialValue={this.state.displayName} label="Click to set display name." onValueChanged={this.onValueChanged}/>
            );
        }
    }
});
