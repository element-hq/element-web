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
    displayName: 'CustomServerDialog',

    render: function() {
        return (
            <div className="mx_ErrorDialog">
                <div className="mx_ErrorDialogTitle">
                    Custom Server Options
                </div>
                <div className="mx_Dialog_content">
                    <span>
                        You can use the custom server options to log into other Matrix
                        servers by specifying a different Home server URL.
                        <br/>
                        This allows you to use this app with an existing Matrix account on
                        a different Home server.
                        <br/>
                        <br/>
                        You can also set a custom Identity server but this will affect
                        people&#39;s ability to find you if you use a server in a group other
                        than the main Matrix.org group.
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
