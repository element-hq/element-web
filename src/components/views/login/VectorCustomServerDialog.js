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

var React = require("react");

module.exports = React.createClass({
    displayName: 'VectorCustomServerDialog',
    statics: {
        replaces: 'CustomServerDialog',
    },

    render: function() {
        return (
            <div className="mx_ErrorDialog">
                <div className="mx_Dialog_title">
                    Custom Server Options
                </div>
                <div className="mx_Dialog_content">
                    <span>
                        You can use the custom server options to log into other Matrix
                        servers by specifying a different Home server URL.
                        <br/>
                        This allows you to use Vector with an existing Matrix account on
                        a different home server.
                        <br/>
                        <br/>
                        You can also set a custom identity server but you won't be able to
                        invite users by email address, or be invited by email address yourself.
                    </span>
                </div>
                <div className="mx_Dialog_buttons">
                    <button onClick={this.props.onFinished} autoFocus={true}>
                        Dismiss
                    </button>
                </div>
            </div>
        );
    }
});
