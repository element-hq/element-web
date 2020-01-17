/*
Copyright 2019 The Matrix.org Foundation C.I.C.

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
import {MatrixClientPeg} from "../../../../../MatrixClientPeg";
import Pill from "../../../elements/Pill";
import {makeUserPermalink} from "../../../../../utils/permalinks/Permalinks";
import BaseAvatar from "../../../avatars/BaseAvatar";
import {getHttpUriForMxc} from "matrix-js-sdk/src/content-repo";

const BRIDGE_EVENT_TYPES = [
    "uk.half-shot.bridge",
    // m.bridge
];

export default class BridgeSettingsTab extends React.Component {
    static propTypes = {
        roomId: PropTypes.string.isRequired,
    };

    _renderBridgeCard(event, room) {
        const content = event.getContent();
        if (!content || !content.channel || !content.protocol) {
            return null;
        }
        const { channel, network } = content;
        const protocolName = content.protocol.displayname || content.protocol.id;
        const channelName = channel.displayname || channel.id;
        const networkName = network ? network.displayname || network.id : protocolName;

        let creator = null;
        if (content.creator) {
            creator = <p> { _t("This bridge was provisioned by <user />", {}, {
                    user: <Pill
                        type={Pill.TYPE_USER_MENTION}
                        room={room}
                        url={makeUserPermalink(content.creator)}
                        shouldShowPillAvatar={true}
                    />,
                })}</p>;
        }

        const bot = (<p> {_t("This bridge is managed by <user />.", {}, {
            user: <Pill
                type={Pill.TYPE_USER_MENTION}
                room={room}
                url={makeUserPermalink(event.getSender())}
                shouldShowPillAvatar={true}
                />,
        })} </p>);
        let channelLink = channelName;
        if (channel.external_url) {
            channelLink = <a target="_blank" href={channel.external_url} rel="noopener">{channelName}</a>;
        }

        let networkLink = networkName;
        if (network && network.external_url) {
            networkLink = <a target="_blank" href={network.external_url} rel="noopener">{networkName}</a>;
        }

        const chanAndNetworkInfo = (
            _t("Bridged into <channelLink /> <networkLink />, on <protocolName />", {}, {
                channelLink,
                networkLink,
                protocolName,
            })
        );

        let networkIcon = null;
        if (networkName && network.avatar) {
            const avatarUrl = getHttpUriForMxc(
                MatrixClientPeg.get().getHomeserverUrl(),
                network.avatar, 32, 32, "crop",
            );
            networkIcon = <BaseAvatar
                width={32}
                height={32}
                resizeMethod='crop'
                name={ networkName }
                idName={ networkName }
                url={ avatarUrl }
            />;
        }

        let channelIcon = null;
        if (channel.avatar) {
            const avatarUrl = getHttpUriForMxc(
                MatrixClientPeg.get().getHomeserverUrl(),
                channel.avatar, 32, 32, "crop",
            );
            channelIcon = <BaseAvatar
                width={32}
                height={32}
                resizeMethod='crop'
                name={ networkName }
                idName={ networkName }
                url={ avatarUrl }
            />;
        }

        const heading = _t("Connected to <channelIcon /> <channelName /> on <networkIcon /> <networkName />", { }, {
            channelIcon,
            channelName,
            networkName,
            networkIcon,
        });

        return (<li key={event.stateKey}>
            <div>
                <h3>{heading}</h3>
                <p>{_t("Connected via %(protocolName)s", { protocolName })}</p>
                <details>
                    {creator}
                    {bot}
                    <p>{chanAndNetworkInfo}</p>
                </details>
            </div>
        </li>);
    }

    static getBridgeStateEvents(roomId) {
        const client = MatrixClientPeg.get();
        const roomState = (client.getRoom(roomId)).currentState;

        const bridgeEvents = [].concat(...BRIDGE_EVENT_TYPES.map((typeName) =>
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
                    <p>{ _t("Below is a list of bridges connected to this room.") }</p>
                    <ul className="mx_RoomSettingsDialog_BridgeList">
                        { bridgeEvents.map((event) => this._renderBridgeCard(event, room)) }
                    </ul>
                </div>
            </div>
        );
    }
}
