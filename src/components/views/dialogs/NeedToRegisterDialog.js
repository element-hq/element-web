/*
Copyright 2016 OpenMarket Ltd

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

/*
 * Usage:
 * Modal.createDialog(NeedToRegisterDialog, {
 *   title: "some text", (default: "Registration required")
 *   description: "some more text",
 *   onFinished: someFunction,
 * });
 */

var React = require("react");
var dis = require("../../../dispatcher");

module.exports = React.createClass({
    displayName: 'NeedToRegisterDialog',
    propTypes: {
        title: React.PropTypes.string,
        description: React.PropTypes.oneOfType([
            React.PropTypes.element,
            React.PropTypes.string,
        ]),
        onFinished: React.PropTypes.func.isRequired,
    },

    getDefaultProps: function() {
        return {
            title: "Registration required",
            description: "A registered account is required for this action",
        };
    },

    onRegisterClicked: function() {
        dis.dispatch({
            action: "start_upgrade_registration",
        });
        if (this.props.onFinished) {
            this.props.onFinished();
        }
    },

    render: function() {
        return (
            <div className="mx_NeedToRegisterDialog">
                <div className="mx_Dialog_title">
                    {this.props.title}
                </div>
                <div className="mx_Dialog_content">
                    {this.props.description}
                </div>
                <div className="mx_Dialog_buttons">
                    <button className="mx_Dialog_primary" onClick={this.props.onFinished} autoFocus={true}>
                        Cancel
                    </button>
                    <button onClick={this.onRegisterClicked}>
                        Register
                    </button>
                </div>
            </div>
        );
    }
});
