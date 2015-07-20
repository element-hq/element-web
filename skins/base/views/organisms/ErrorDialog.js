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

/*
 * Usage: 
 * Modal.createDialog(ErrorDialog, {
 *   title: "some text", (default: "Error")
 *   description: "some more text",
 *   button: "Button Text",
 *   onClose: someFunction,
 *   focus: true|false (default: true)
 * });
 */

var React = require('react');

module.exports = React.createClass({
    displayName: 'ErrorDialog',

    // can't use getDefaultProps, see Modal.js
    componentWillMount: function() {
        if (!this.props.title) {
            this.props.title = "Error";
        }
        if (!this.props.description) {
            this.props.description = "An error has occurred.";
        }
        if (!this.props.button) {
            this.props.button = "OK";
        }
        if (this.props.focus === undefined) {
            this.props.focus = true;
        }
        if (!this.props.onClose) {
            var self = this;
            this.props.onClose = function() {
                self.props.onFinished();
            };
        }
    },

    render: function() {
        return (
            <div className="mx_ErrorDialog">
                <div className="mx_ErrorDialogTitle">
                    {this.props.title}
                </div>
                {this.props.description}<br />
                <button onClick={this.props.onClose} autoFocus={this.props.focus}>
                    {this.props.button}
                </button>
            </div>
        );
    }
});

