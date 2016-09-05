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
var MatrixClientPeg = require("../../../MatrixClientPeg");
var rate_limited_func = require("../../../ratelimitedfunc");
var Modal = require('../../../Modal');

const TRUNCATE_QUERY_LIST = 4;

module.exports = React.createClass({
    displayName: "ChatInviteDialog",
    propTypes: {
        title: React.PropTypes.string,
        description: React.PropTypes.oneOfType([
            React.PropTypes.element,
            React.PropTypes.string,
        ]),
        value: React.PropTypes.string,
        placeholder: React.PropTypes.string,
        button: React.PropTypes.string,
        focus: React.PropTypes.bool,
        onFinished: React.PropTypes.func.isRequired
    },

    getDefaultProps: function() {
        return {
            title: "Start a chat",
            description: "Who would you like to communicate with?",
            value: "",
            placeholder: "User ID, Name or email",
            button: "Start Chat",
            focus: true
        };
    },

    getInitialState: function() {
        return {
            query: "",
            queryList: [],
            addressSelected: false,
        };
    },

    componentDidMount: function() {
        if (this.props.focus) {
            // Set the cursor at the end of the text input
            this.refs.textinput.value = this.props.value;
        }
        this._updateUserList();
    },

    onStartChat: function() {
        this._startChat(this.refs.textinput.value);
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
            //this._startChat(this.refs.textinput.value);
            this.setState({ addressSelected: true });
        }
    },

    onQueryChanged: function(ev) {
        var query = ev.target.value;
        var queryList = this._userList.filter((user) => {
            return this._matches(query, user);
        });
        this.setState({ queryList: queryList });
    },

    onDismissed: function() {
        this.setState({ addressSelected: false });
    },

    _startChat: function(addr) {
        // Start the chat
        createRoom().then(function(roomId) {
            return Invite.inviteToRoom(roomId, addr);
        })
        .catch(function(err) {
            var ErrorDialog = sdk.getComponent("dialogs.ErrorDialog");
            Modal.createDialog(ErrorDialog, {
                title: "Failure to invite user",
                description: err.toString()
            });
            return null;
        })
        .done();

        // Close - this will happen before the above, as that is async
        this.props.onFinished(true, addr);
    },

    _updateUserList: new rate_limited_func(function() {
        // Get all the users
        this._userList = MatrixClientPeg.get().getUsers();
    }, 500),

    // This is the search algorithm for matching users
    _matches: function(query, user) {
        var name = user.displayName.toLowerCase();
        var uid = user.userId.toLowerCase();
        query = query.toLowerCase();

        // direct prefix matches
        if (name.indexOf(query) === 0 || uid.indexOf(query) === 0) {
            return true;
        }

        // strip @ on uid and try matching again
        if (uid.length > 1 && uid[0] === "@" && uid.substring(1).indexOf(query) === 0) {
            return true;
        }

        // split spaces in name and try matching constituent parts
        var parts = name.split(" ");
        for (var i = 0; i < parts.length; i++) {
            if (parts[i].indexOf(query) === 0) {
                return true;
            }
        }
        return false;
    },

    render: function() {
        var TintableSvg = sdk.getComponent("elements.TintableSvg");
        console.log("### D E B U G - queryList:");
        console.log(this.state.queryList);

        var query;
        if (this.state.addressSelected) {
            var AddressTile = sdk.getComponent("elements.AddressTile");
            // NOTE: this.state.queryList[0] is just a place holder until the selection logic is completed
            query = (
                <AddressTile user={this.state.queryList[0]} canDismiss={true} onDismissed={this.onDismissed} />
            );
        } else {
            query = (
                <input type="text"
                    id="textinput"
                    ref="textinput"
                    className="mx_ChatInviteDialog_input"
                    onChange={this.onQueryChanged}
                    placeholder={this.props.placeholder}
                    defaultValue={this.props.value}
                    autoFocus={this.props.focus}
                    onKeyDown={this.onKeyDown}
                    autoComplete="off"
                    size="64"/>
            );
        }

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
                    <div>{ query }</div>
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
