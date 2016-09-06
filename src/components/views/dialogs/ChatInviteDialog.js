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

const TRUNCATE_QUERY_LIST = 40;

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
            user: null,
            queryList: [],
            addressSelected: false,
            selected: 0,
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
        if (this.state.user) {
            this._startChat(this.state.user.userId);
        } else {
            this._startChat(this.refs.textinput.value);
        }
    },

    onCancel: function() {
        this.props.onFinished(false);
    },

    onKeyDown: function(e) {
        if (e.keyCode === 27) { // escape
            e.stopPropagation();
            e.preventDefault();
            this.props.onFinished(false);
        } else if (e.keyCode === 38) { // up arrow
            e.stopPropagation();
            e.preventDefault();
            if (this.state.selected > 0) {
                this.setState({ selected: this.state.selected - 1 });
            }
        } else if (e.keyCode === 40) { // down arrow
            e.stopPropagation();
            e.preventDefault();
            if (this.state.selected < this._maxSelected(this.state.queryList)) {
                this.setState({ selected: this.state.selected + 1 });
            }
        } else if (e.keyCode === 13) { // enter
            e.stopPropagation();
            e.preventDefault();
            if (this.state.queryList.length > 0) {
                this.setState({
                    user: this.state.queryList[this.state.selected],
                    addressSelected: true,
                    queryList: [],
                });
            }
        }
    },

    onQueryChanged: function(ev) {
        var query = ev.target.value;
        var queryList = [];

        // Only do search if there is something to search
        if (query.length > 0) {
            queryList = this._userList.filter((user) => {
                return this._matches(query, user);
            });
        }

        // Make sure the selected item isn't outside the list bounds
        var selected = this.state.selected;
        var maxSelected = this._maxSelected(queryList);
        if (selected > maxSelected) {
            selected = maxSelected;
        }

        this.setState({
            queryList: queryList,
            selected: selected,
        });
    },

    onDismissed: function() {
        this.setState({
            user: null,
            addressSelected: false,
            selected: 0,
            queryList: [],
        });
    },

    createQueryListTiles: function() {
        var self = this;
        var AddressTile = sdk.getComponent("elements.AddressTile");
        var maxSelected = this._maxSelected(this.state.queryList);
        var queryList = [];
        if (this.state.queryList.length > 0) {
            for (var i = 0; i <= maxSelected; i++) {
                queryList.push(
                    <div className="mx_ChatInviteDialog_queryListElement" key={i} >
                        <AddressTile user={this.state.queryList[i]} canDismiss={false} />
                    </div>
                );
            }
        }
        return queryList;
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

    _maxSelected: function(list) {
        var listSize = list.length === 0 ? 0 : list.length - 1;
        var maxSelected = listSize > (TRUNCATE_QUERY_LIST - 1) ? (TRUNCATE_QUERY_LIST - 1) : listSize
        return maxSelected;
    },

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
            query = (
                <AddressTile user={this.state.user} canDismiss={true} onDismissed={this.onDismissed} />
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

        var queryList;
        var queryListElements = this.createQueryListTiles();
        if (queryListElements.length > 0) {
            queryList = (
                <div className="mx_ChatInviteDialog_queryList">
                    { queryListElements }
                </div>
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
                    <label htmlFor="textinput">{ this.props.description }</label>
                </div>
                <div className="mx_Dialog_content">
                    <div className="mx_ChatInviteDialog_inputContainer">{ query }</div>
                    { queryList }
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
