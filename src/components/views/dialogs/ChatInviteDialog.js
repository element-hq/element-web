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
var classNames = require('classnames');
var sdk = require("../../../index");
var Invite = require("../../../Invite");
var createRoom = require("../../../createRoom");
var MatrixClientPeg = require("../../../MatrixClientPeg");
var DMRoomMap = require('../../../utils/DMRoomMap');
var rate_limited_func = require("../../../ratelimitedfunc");
var dis = require("../../../dispatcher");
var Modal = require('../../../Modal');

const TRUNCATE_QUERY_LIST = 40;

/*
 * Escapes a string so it can be used in a RegExp
 * Basically just replaces: \ ^ $ * + ? . ( ) | { } [ ]
 * From http://stackoverflow.com/a/6969486
 */
function escapeRegExp(str) {
    return str.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&");
}

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
        roomId: React.PropTypes.string,
        button: React.PropTypes.string,
        focus: React.PropTypes.bool,
        onFinished: React.PropTypes.func.isRequired
    },

    getDefaultProps: function() {
        return {
            title: "Start a chat",
            description: "Who would you like to communicate with?",
            value: "",
            placeholder: "Email, name or matrix ID",
            button: "Start Chat",
            focus: true
        };
    },

    getInitialState: function() {
        return {
            error: false,
            inviteList: [],
            queryList: [],
        };
    },

    componentDidMount: function() {
        if (this.props.focus) {
            // Set the cursor at the end of the text input
            this.refs.textinput.value = this.props.value;
        }
        this._updateUserList();
    },

    onButtonClick: function() {
        let inviteList = this.state.inviteList.slice();
        // Check the text input field to see if user has an unconverted address
        // If there is and it's valid add it to the local inviteList
        if (this.refs.textinput.value !== '') {
            inviteList = this._addInputToList();
            if (inviteList === null) return;
        }

        if (inviteList.length > 0) {
            if (this._isDmChat(inviteList)) {
                // Direct Message chat
                var room = this._getDirectMessageRoom(inviteList[0]);
                if (room) {
                    // A Direct Message room already exists for this user and you
                    // so go straight to that room
                    dis.dispatch({
                        action: 'view_room',
                        room_id: room.roomId,
                    });
                    this.props.onFinished(true, inviteList[0]);
                } else {
                    this._startChat(inviteList);
                }
            } else {
                // Multi invite chat
                this._startChat(inviteList);
            }
        } else {
            // No addresses supplied
            this.setState({ error: true });
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
            this.addressSelector.moveSelectionUp();
        } else if (e.keyCode === 40) { // down arrow
            e.stopPropagation();
            e.preventDefault();
            this.addressSelector.moveSelectionDown();
        } else if (this.state.queryList.length > 0 && (e.keyCode === 188 || e.keyCode === 13 || e.keyCode === 9)) { // comma or enter or tab
            e.stopPropagation();
            e.preventDefault();
            this.addressSelector.chooseSelection();
        } else if (this.refs.textinput.value.length === 0 && this.state.inviteList.length && e.keyCode === 8) { // backspace
            e.stopPropagation();
            e.preventDefault();
            this.onDismissed(this.state.inviteList.length - 1)();
        } else if (e.keyCode === 13) { // enter
            e.stopPropagation();
            e.preventDefault();
            if (this.refs.textinput.value == '') {
                // if there's nothing in the input box, submit the form
                this.onButtonClick();
            } else {
                this._addInputToList();
            }
        } else if (e.keyCode === 188 || e.keyCode === 9) { // comma or tab
            e.stopPropagation();
            e.preventDefault();
            this._addInputToList();
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

        this.setState({
            queryList: queryList,
            error: false,
        });
    },

    onDismissed: function(index) {
        var self = this;
        return function() {
            var inviteList = self.state.inviteList.slice();
            inviteList.splice(index, 1);
            self.setState({
                inviteList: inviteList,
                queryList: [],
            });
        };
    },

    onClick: function(index) {
        var self = this;
        return function() {
            self.onSelected(index);
        };
    },

    onSelected: function(index) {
        var inviteList = this.state.inviteList.slice();
        inviteList.push(this.state.queryList[index].userId);
        this.setState({
            inviteList: inviteList,
            queryList: [],
        });
    },

    _getDirectMessageRoom: function(addr) {
        const dmRoomMap = new DMRoomMap(MatrixClientPeg.get());
        var dmRooms = dmRoomMap.getDMRoomsForUserId(addr);
        if (dmRooms.length > 0) {
            // Cycle through all the DM rooms and find the first non forgotten or parted room
            for (let i = 0; i < dmRooms.length; i++) {
                let room = MatrixClientPeg.get().getRoom(dmRooms[i]);
                if (room) {
                    const me = room.getMember(MatrixClientPeg.get().credentials.userId);
                    if (me.membership == 'join') {
                        return room;
                    }
                }
            }
        }
        return null;
    },

    _startChat: function(addrs) {
        if (MatrixClientPeg.get().isGuest()) {
            var NeedToRegisterDialog = sdk.getComponent("dialogs.NeedToRegisterDialog");
            Modal.createDialog(NeedToRegisterDialog, {
                title: "Please Register",
                description: "Guest users can't invite users. Please register."
            });
            return;
        }

        if (this.props.roomId) {
            // Invite new user to a room
            var self = this;
            Invite.inviteMultipleToRoom(this.props.roomId, addrs)
            .then(function(addrs) {
                var room = MatrixClientPeg.get().getRoom(self.props.roomId);
                return self._showAnyInviteErrors(addrs, room);
            })
            .catch(function(err) {
                console.error(err.stack);
                var ErrorDialog = sdk.getComponent("dialogs.ErrorDialog");
                Modal.createDialog(ErrorDialog, {
                    title: "Failure to invite",
                    description: err.toString()
                });
                return null;
            })
            .done();
        } else if (this._isDmChat(addrs)) {
            // Start the DM chat
            createRoom({dmUserId: addrs[0]})
            .catch(function(err) {
                console.error(err.stack);
                var ErrorDialog = sdk.getComponent("dialogs.ErrorDialog");
                Modal.createDialog(ErrorDialog, {
                    title: "Failure to invite user",
                    description: err.toString()
                });
                return null;
            })
            .done();
        } else {
            // Start multi user chat
            var self = this;
            var room;
            createRoom().then(function(roomId) {
                room = MatrixClientPeg.get().getRoom(roomId);
                return Invite.inviteMultipleToRoom(roomId, addrs);
            })
            .then(function(addrs) {
                return self._showAnyInviteErrors(addrs, room);
            })
            .catch(function(err) {
                console.error(err.stack);
                var ErrorDialog = sdk.getComponent("dialogs.ErrorDialog");
                Modal.createDialog(ErrorDialog, {
                    title: "Failure to invite",
                    description: err.toString()
                });
                return null;
            })
            .done();
        }

        // Close - this will happen before the above, as that is async
        this.props.onFinished(true, addrs);
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

        // don't match any that are already on the invite list
        if (this._isOnInviteList(uid)) {
            return false;
        }

        // ignore current user
        if (uid === MatrixClientPeg.get().credentials.userId) {
            return false;
        }

        // direct prefix matches
        if (name.indexOf(query) === 0 || uid.indexOf(query) === 0) {
            return true;
        }

        // strip @ on uid and try matching again
        if (uid.length > 1 && uid[0] === "@" && uid.substring(1).indexOf(query) === 0) {
            return true;
        }

        // Try to find the query following a "word boundary", except that
        // this does avoids using \b because it only considers letters from
        // the roman alphabet to be word characters.
        // Instead, we look for the query following either:
        //  * The start of the string
        //  * Whitespace, or
        //  * A fixed number of punctuation characters
        const expr = new RegExp("(?:^|[\\s\\(\)'\",\.-_@\?;:{}\\[\\]\\#~`\\*\\&\\$])" + escapeRegExp(query));
        if (expr.test(name)) {
            return true;
        }

        return false;
    },

    _isOnInviteList: function(uid) {
        for (let i = 0; i < this.state.inviteList.length; i++) {
            if (this.state.inviteList[i].toLowerCase() === uid) {
                return true;
            }
        }
        return false;
    },

    _isDmChat: function(addrs) {
        if (addrs.length === 1 && Invite.getAddressType(addrs[0]) === "mx" && !this.props.roomId) {
            return true;
        } else {
            return false;
        }
    },

    _showAnyInviteErrors: function(addrs, room) {
        // Show user any errors
        var errorList = [];
        for (var addr in addrs) {
            if (addrs.hasOwnProperty(addr) && addrs[addr] === "error") {
                errorList.push(addr);
            }
        }

        if (errorList.length > 0) {
            var ErrorDialog = sdk.getComponent("dialogs.ErrorDialog");
            Modal.createDialog(ErrorDialog, {
                title: "Failed to invite the following users to the " + room.name + " room:",
                description: errorList.join(", "),
            });
        }
        return addrs;
    },

    _addInputToList: function() {
        const addrType = Invite.getAddressType(this.refs.textinput.value);
        if (addrType !== null) {
            const inviteList = this.state.inviteList.slice();
            inviteList.push(this.refs.textinput.value.trim());
            this.setState({
                inviteList: inviteList,
                queryList: [],
            });
            return inviteList;
        } else {
            this.setState({ error: true });
            return null;
        }
    },

    render: function() {
        var TintableSvg = sdk.getComponent("elements.TintableSvg");
        var AddressSelector = sdk.getComponent("elements.AddressSelector");
        this.scrollElement = null;

        var query = [];
        // create the invite list
        if (this.state.inviteList.length > 0) {
            var AddressTile = sdk.getComponent("elements.AddressTile");
            for (let i = 0; i < this.state.inviteList.length; i++) {
                query.push(
                    <AddressTile key={i} address={this.state.inviteList[i]} canDismiss={true} onDismissed={ this.onDismissed(i) } />
                );
            }
        }

        // Add the query at the end
        query.push(
            <textarea key={this.state.inviteList.length}
                rows="1"
                id="textinput"
                ref="textinput"
                className="mx_ChatInviteDialog_input"
                onChange={this.onQueryChanged}
                placeholder={this.props.placeholder}
                defaultValue={this.props.value}
                autoFocus={this.props.focus}>
            </textarea>
        );

        var error;
        var addressSelector;
        if (this.state.error) {
            error = <div className="mx_ChatInviteDialog_error">You have entered an invalid contact. Try using their Matrix ID or email address.</div>;
        } else {
            addressSelector = (
                <AddressSelector ref={(ref) => {this.addressSelector = ref;}}
                    addressList={ this.state.queryList }
                    onSelected={ this.onSelected }
                    truncateAt={ TRUNCATE_QUERY_LIST } />
            );
        }

        return (
            <div className="mx_ChatInviteDialog" onKeyDown={this.onKeyDown}>
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
                    { error }
                    { addressSelector }
                </div>
                <div className="mx_Dialog_buttons">
                    <button className="mx_Dialog_primary" onClick={this.onButtonClick}>
                        {this.props.button}
                    </button>
                </div>
            </div>
        );
    }
});
