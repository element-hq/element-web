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
var dis = require("../../../dispatcher");

module.exports = React.createClass({
    displayName: 'LogoutPrompt',
    logOut: function() {
        dis.dispatch({action: 'logout'});
        if (this.props.onFinished) {
            this.props.onFinished();
        }
    },

    cancelPrompt: function() {
        if (this.props.onFinished) {
            this.props.onFinished();
        }
    },

    render: function() {
        return (
            <div>
                <div className="mx_Dialog_content">
                    Sign out?
                </div>
                <div className="mx_Dialog_buttons">
                    <button onClick={this.logOut}>Sign Out</button>
                    <button onClick={this.cancelPrompt}>Cancel</button>
                </div>
            </div>
        );
    }
});

