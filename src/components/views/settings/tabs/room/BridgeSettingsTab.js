/*
Copyright 2019 New Vector Ltd

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
import {_t} from "../../../../../languageHandler";
import MatrixClientPeg from "../../../../../MatrixClientPeg";
import Pill from "../../../elements/Pill";
import {makeUserPermalink} from "../../../../../utils/permalinks/Permalinks";

const BRIDGE_EVENT_TYPES = [
    "uk.half-shot.bridge",
    // m.bridge
];

export default class BridgeSettingsTab extends React.Component {
    static propTypes = {
        roomId: PropTypes.string.isRequired,
    };

    constructor() {
        super();

        this.state = {
        };
    }

    componentWillMount() {

    }

    _renderBridgeCard(event, room) {
        const content = event.getContent();
        if (!content || !content.channel || !content.protocol) {
            return null;
        }
        const protocolName = content.protocol.displayname || content.protocol.id;
        const channelName = content.channel.displayname || content.channel.id;
        const networkName = content.network ? " on " + (content.network.displayname || content.network.id) : "";
        let status = null;
        if (content.status === "active") {
            status = (<p> Status: <b>Active</b> </p>);
        } else if (content.status === "disabled") {
            status = (<p> Status: <b>Disabled</b> </p>);
        }

        let creator = null;
        if (content.creator) {
            creator = (<p>
                This bridge was provisioned by <Pill
                    type={Pill.TYPE_USER_MENTION}
                    room={room}
                    url={makeUserPermalink(content.creator)}
                    shouldShowPillAvatar={true}
                />
            </p>);
        }

        const bot = (<p>
            The bridge is managed by the <Pill
            type={Pill.TYPE_USER_MENTION}
            room={room}
            url={makeUserPermalink(event.getSender())}
            shouldShowPillAvatar={true}
            /> bot user.</p>
        );

        const chanAndNetworkInfo = (
            <p> Bridged into {channelName}{networkName}, on {protocolName}</p>
        );

        return (<li key={event.stateKey}>
            <div>
                <h3>{channelName}{networkName} ({protocolName})</h3>
                <details>
                    {status}
                    {creator}
                    {bot}
                    {chanAndNetworkInfo}
                </details>
            </div>
        </li>);
    }

    static getBridgeStateEvents(roomId) {
        const client = MatrixClientPeg.get();
        const roomState = (client.getRoom(roomId)).currentState;

        const bridgeEvents = Array.concat(...BRIDGE_EVENT_TYPES.map((typeName) =>
            Object.values(roomState.events[typeName] || {}),
        ));

        return bridgeEvents;
    }

    render() {
        // This settings tab will only be invoked if the following function returns more
        // than 0 events, so no validation is needed at this stage.
        const bridgeEvents = BridgeSettingsTab.getBridgeStateEvents(this.props.roomId);
        const client = MatrixClientPeg.get();
        const room = client.getRoom(this.props.roomId);

        return (
            <div className="mx_SettingsTab">
                <div className="mx_SettingsTab_heading">{_t("Bridge Info")}</div>
                <div className='mx_SettingsTab_section mx_SettingsTab_subsectionText'>
                    <p> Below is a list of bridges connected to this room. </p>
                    <ul className="mx_RoomSettingsDialog_BridgeList">
                        { bridgeEvents.map((event) => this._renderBridgeCard(event, room)) }
                    </ul>
                </div>
            </div>
        );
    }
}
