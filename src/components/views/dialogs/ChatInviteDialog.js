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
var sdk = require("../../../index");
var Invite = require("../../../Invite");
var createRoom = require("../../../createRoom");
var Modal = require('../../../Modal');

module.exports = React.createClass({
    displayName: "ChatInviteDialog",
    propTypes: {
        title: React.PropTypes.string,
        description: React.PropTypes.oneOfType([
            React.PropTypes.element,
            React.PropTypes.string,
        ]),
        value: React.PropTypes.string,
        button: React.PropTypes.string,
        focus: React.PropTypes.bool,
        onFinished: React.PropTypes.func.isRequired
    },

    getDefaultProps: function() {
        return {
            title: "",
            value: "",
            description: "",
            button: "Start Chat",
            focus: true
        };
    },

    componentDidMount: function() {
        if (this.props.focus) {
            // Set the cursor at the end of the text input
            this.refs.textinput.value = this.props.value;
        }
    },

    onStartChat: function() {
        this._startChat(this.refs.textinput.value);
    },

    _startChat: function(addr) {
        createRoom().then(function(roomId) {
            return Invite.inviteToRoom(roomId, addr);
        })
        .catch(function(err) {
            var ErrorDialog = sdk.getComponent("dialogs.ErrorDialog");
            Modal.createDialog(ErrorDialog, {
                title: "Failure to invite " + addr,
                description: err.toString()
            });
            return null;
        })
        .done();
        this.props.onFinished(true, addr);
    },

    onCancel: function() {
        this.props.onFinished(false);
    },

    onKeyDown: function(e) {
        if (e.keyCode === 27) { // escape
            e.stopPropagation();
            e.preventDefault();
            this.props.onFinished(false);
        }
        else if (e.keyCode === 13) { // enter
            e.stopPropagation();
            e.preventDefault();
            this._startChat(this.refs.textinput.value);
        }
    },

    render: function() {
        var TintableSvg = sdk.getComponent("elements.TintableSvg");
        return (
            <div className="mx_ChatInviteDialog">
                <div className="mx_Dialog_title">
                    {this.props.title}
                </div>
                <div className="mx_ChatInviteDialog_cancel" onClick={this.onCancel} >
                    <TintableSvg src="img/icons-close-button.svg" width="35" height="35" />
                </div>
                <div className="mx_ChatInviteDialog_label">
                    <label htmlFor="textinput"> {this.props.description} </label>
                </div>
                <div className="mx_Dialog_content">
                    <div>
                        <input id="textinput" ref="textinput" className="mx_ChatInviteDialog_input" placeholder={this.props.placeholder} defaultValue={this.props.value} autoFocus={this.props.focus} size="64" onKeyDown={this.onKeyDown}/>
                    </div>
                </div>
                <div className="mx_Dialog_buttons">
                    <button className="mx_Dialog_primary" onClick={this.onStartChat}>
                        {this.props.button}
                    </button>
                </div>
            </div>
        );
    }
});
