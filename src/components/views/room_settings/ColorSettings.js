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

import React from 'react';
import PropTypes from 'prop-types';
import createReactClass from 'create-react-class';

import Tinter from '../../../Tinter';
import dis from '../../../dispatcher/dispatcher';
import SettingsStore, {SettingLevel} from "../../../settings/SettingsStore";

const ROOM_COLORS = [
    // magic room default values courtesy of Ribot
    [Tinter.getKeyRgb()[0], Tinter.getKeyRgb()[1]],
    ["#81bddb", "#eaf1f4"],
    ["#bd79cb", "#f3eaf5"],
    ["#c65d94", "#f5eaef"],
    ["#e55e5e", "#f5eaea"],
    ["#eca46f", "#f5eeea"],
    ["#dad658", "#f5f4ea"],
    ["#80c553", "#eef5ea"],
    ["#bb814e", "#eee8e3"],
    //["#595959", "#ececec"], // Grey makes everything appear disabled, so remove it for now
];

// Dev note: this component is not attached anywhere, but is left here as it
// has a high possibility of being used in the nearish future.
// Ref: https://github.com/vector-im/riot-web/issues/8421

export default createReactClass({
    displayName: 'ColorSettings',

    propTypes: {
        room: PropTypes.object.isRequired,
    },

    getInitialState: function() {
        const data = {
            index: 0,
            primary_color: ROOM_COLORS[0][0],
            secondary_color: ROOM_COLORS[0][1],
            hasChanged: false,
        };
        const scheme = SettingsStore.getValueAt(SettingLevel.ROOM_ACCOUNT, "roomColor", this.props.room.roomId);

        if (scheme.primary_color && scheme.secondary_color) {
            // We only use the user's scheme if the scheme is valid.
            data.primary_color = scheme.primary_color;
            data.secondary_color = scheme.secondary_color;
        }
        data.index = this._getColorIndex(data);

        if (data.index === -1) {
            // append the unrecognised colours to our palette
            data.index = ROOM_COLORS.length;
            ROOM_COLORS.push([
                scheme.primary_color, scheme.secondary_color,
            ]);
        }
        return data;
    },

    saveSettings: function() { // : Promise
        if (!this.state.hasChanged) {
            return Promise.resolve(); // They didn't explicitly give a color to save.
        }
        const originalState = this.getInitialState();
        if (originalState.primary_color !== this.state.primary_color ||
                originalState.secondary_color !== this.state.secondary_color) {
            console.log("ColorSettings: Saving new color");
            // We would like guests to be able to set room colour but currently
            // they can't, so we still send the request but display a sensible
            // error if it fails.
            // TODO: Support guests for room color. Technically this is possible via granular settings
            // Granular settings would mean the guest is forced to use the DEVICE level though.
            SettingsStore.setValue("roomColor", this.props.room.roomId, SettingLevel.ROOM_ACCOUNT, {
                primary_color: this.state.primary_color,
                secondary_color: this.state.secondary_color,
            }).catch(function(err) {
                if (err.errcode === 'M_GUEST_ACCESS_FORBIDDEN') {
                    dis.dispatch({action: 'require_registration'});
                }
            });
        }
        return Promise.resolve(); // no color diff
    },

    _getColorIndex: function(scheme) {
        if (!scheme || !scheme.primary_color || !scheme.secondary_color) {
            return -1;
        }
        // XXX: we should validate these values
        for (let i = 0; i < ROOM_COLORS.length; i++) {
            const room_color = ROOM_COLORS[i];
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
            hasChanged: true,
        });
    },

    render: function() {
        return (
            <div className="mx_ColorSettings_roomColors">
                { ROOM_COLORS.map((room_color, i) => {
                    let selected;
                    if (i === this.state.index) {
                        selected = (
                            <div className="mx_ColorSettings_roomColor_selected">
                                <img src={require("../../../../res/img/tick.svg")} width="17" height="14" alt="./" />
                            </div>
                        );
                    }
                    const boundClick = this._onColorSchemeChanged.bind(this, i);
                    return (
                        <div className="mx_ColorSettings_roomColor"
                              key={"room_color_" + i}
                              style={{ backgroundColor: room_color[1] }}
                              onClick={boundClick}>
                            { selected }
                            <div className="mx_ColorSettings_roomColorPrimary" style={{ backgroundColor: room_color[0] }}></div>
                        </div>
                    );
                }) }
            </div>
        );
    },
});
