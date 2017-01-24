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
var q = require("q");
var React = require('react');

var sdk = require('../../../index');
var Tinter = require('../../../Tinter');
var MatrixClientPeg = require("../../../MatrixClientPeg");
var Modal = require("../../../Modal");

var ROOM_COLORS = [
    // magic room default values courtesy of Ribot
    ["#76cfa6", "#eaf5f0"],
    ["#81bddb", "#eaf1f4"],
    ["#bd79cb", "#f3eaf5"],
    ["#c65d94", "#f5eaef"],
    ["#e55e5e", "#f5eaea"],
    ["#eca46f", "#f5eeea"],
    ["#dad658", "#f5f4ea"],
    ["#80c553", "#eef5ea"],
    ["#bb814e", "#eee8e3"],
    ["#595959", "#ececec"],
];

module.exports = React.createClass({
    displayName: 'ColorSettings',

    propTypes: {
        room: React.PropTypes.object.isRequired
    },

    getInitialState: function() {
        var data = {
            index: 0,
            primary_color: ROOM_COLORS[0].primary_color,
            secondary_color: ROOM_COLORS[0].secondary_color,
            hasChanged: false
        };
        var event = this.props.room.getAccountData("org.matrix.room.color_scheme");
        if (!event) {
            return data;
        }
        var scheme = event.getContent();
        data.primary_color = scheme.primary_color;
        data.secondary_color = scheme.secondary_color;
        data.index = this._getColorIndex(data);

        if (data.index === -1) {
            // append the unrecognised colours to our palette
            data.index = ROOM_COLORS.length;
            ROOM_COLORS.push([
                scheme.primary_color, scheme.secondary_color
            ]);
        }
        return data;
    },

    saveSettings: function() { // : Promise
        if (!this.state.hasChanged) {
            return q(); // They didn't explicitly give a color to save.
        }
        var originalState = this.getInitialState();
        if (originalState.primary_color !== this.state.primary_color ||
                originalState.secondary_color !== this.state.secondary_color) {
            console.log("ColorSettings: Saving new color");
            // We would like guests to be able to set room colour but currently
            // they can't, so we still send the request but display a sensible
            // error if it fails.
            return MatrixClientPeg.get().setRoomAccountData(
                this.props.room.roomId, "org.matrix.room.color_scheme", {
                    primary_color: this.state.primary_color,
                    secondary_color: this.state.secondary_color
                }
            ).catch(function(err) {
                if (err.errcode == 'M_GUEST_ACCESS_FORBIDDEN') {
                    var NeedToRegisterDialog = sdk.getComponent("dialogs.NeedToRegisterDialog");
                    Modal.createDialog(NeedToRegisterDialog, {
                        title: "Please Register",
                        description: "Saving room color settings is only available to registered users"
                    });
                }
            });
        }
        return q(); // no color diff
    },

    _getColorIndex: function(scheme) {
        if (!scheme || !scheme.primary_color || !scheme.secondary_color) {
            return -1;
        }
        // XXX: we should validate these values
        for (var i = 0; i < ROOM_COLORS.length; i++) {
            var room_color = ROOM_COLORS[i];
            if (room_color[0] === String(scheme.primary_color).toLowerCase() &&
                    room_color[1] === String(scheme.secondary_color).toLowerCase()) {
                return i;
            }
        }
        return -1;
    },

    _onColorSchemeChanged: function(index) {
        // preview what the user just changed the scheme to.
        Tinter.tint(ROOM_COLORS[index][0], ROOM_COLORS[index][1]);
        this.setState({
            index: index,
            primary_color: ROOM_COLORS[index][0],
            secondary_color: ROOM_COLORS[index][1],
            hasChanged: true
        });
    },

    render: function() {
        return (
            <div className="mx_RoomSettings_roomColors">
                {ROOM_COLORS.map((room_color, i) => {
                    var selected;
                    if (i === this.state.index) {
                        selected = (
                            <div className="mx_RoomSettings_roomColor_selected">
                                <img src="img/tick.svg" width="17" height="14" alt="./"/>
                            </div>
                        );
                    }
                    var boundClick = this._onColorSchemeChanged.bind(this, i);
                    return (
                        <div className="mx_RoomSettings_roomColor"
                              key={ "room_color_" + i }
                              style={{ backgroundColor: room_color[1] }}
                              onClick={ boundClick }>
                            { selected }
                            <div className="mx_RoomSettings_roomColorPrimary" style={{ backgroundColor: room_color[0] }}></div>
                        </div>
                    );
                })}
            </div>
        );
    }
});
