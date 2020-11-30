/*
Copyright 2020 The Matrix.org Foundation C.I.C.

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

import React, { ReactNode } from 'react';
import PropTypes from 'prop-types';
import {getHttpUriForMxc} from "matrix-js-sdk/src/content-repo";
import {_t} from "../../../languageHandler";
import {MatrixClientPeg} from "../../../MatrixClientPeg";
import Pill from "../elements/Pill";
import {makeUserPermalink} from "../../../utils/permalinks/Permalinks";
import BaseAvatar from "../avatars/BaseAvatar";
import AccessibleButton from "../elements/AccessibleButton";
import {replaceableComponentTs} from "../../../utils/replaceableComponent";
import SettingsStore from "../../../settings/SettingsStore";
import {MatrixEvent} from "matrix-js-sdk/src/models/event";
import { Room } from "matrix-js-sdk/src/models/room";

interface IProps {
    ev: MatrixEvent;
    room: Room;
}

/**
 * This should match https://github.com/matrix-org/matrix-doc/blob/hs/msc-bridge-inf/proposals/2346-bridge-info-state-event.md#mbridge
 */
interface IBridgeStateEvent {
    bridgebot: string;
    creator?: string;
    protocol: {
        id: string;
        displayname?: string;
        avatar_url?: string;
        external_url?: string;
    };
    network?: {
        id: string;
        displayname?: string;
        avatar_url?: string;
        external_url?: string;
    };
    channel: {
        id: string;
        displayname?: string;
        avatar_url?: string;
        external_url?: string;
    };
}

@replaceableComponentTs("views.settings.BridgeTile")
export default class BridgeTile extends React.PureComponent<IProps> {
    static propTypes = {
        ev: PropTypes.object.isRequired,
        room: PropTypes.object.isRequired,
    }

    render() {
        const content: IBridgeStateEvent = this.props.ev.getContent();
        // Validate
        if (!content.bridgebot || !content.channel?.id || !content.protocol?.id) {
            console.warn(`Bridge info event ${this.props.ev.getId()} has missing content. Tile will not render`);
            return null;
        }
        const { channel, network, protocol } = content;
        const protocolName = protocol.displayname || protocol.id;
        const channelName = channel.displayname || channel.id;

        let creator = null;
        if (content.creator) {
            creator = <li>{_t("This bridge was provisioned by <user />.", {}, {
                user: () => <Pill
                    type={Pill.TYPE_USER_MENTION}
                    room={this.props.room}
                    url={makeUserPermalink(content.creator)}
                    shouldShowPillAvatar={SettingsStore.getValue("Pill.shouldShowPillAvatar")}
                />,
            })}</li>;
        }

        const bot = <li>{_t("This bridge is managed by <user />.", {}, {
            user: () => <Pill
                type={Pill.TYPE_USER_MENTION}
                room={this.props.room}
                url={makeUserPermalink(content.bridgebot)}
                shouldShowPillAvatar={SettingsStore.getValue("Pill.shouldShowPillAvatar")}
            />,
        })}</li>;

        let networkIcon;

        if (protocol.avatar_url) {
            const avatarUrl = getHttpUriForMxc(
                MatrixClientPeg.get().getHomeserverUrl(),
                protocol.avatar_url, 64, 64, "crop",
            );

            networkIcon = <BaseAvatar className="protocol-icon"
                width={48}
                height={48}
                resizeMethod='crop'
                name={ protocolName }
                idName={ protocolName }
                url={ avatarUrl }
            />;
        } else {
            networkIcon = <div className="noProtocolIcon"></div>;
        }

        const id = this.props.ev.getId();
        return (<li key={id}>
            <div className="column-icon">
                {networkIcon}
            </div>
            <div className="column-data">
                <h3>{protocolName}</h3>
                <p className="workspace-channel-details">
                    <span>{_t("Workspace: %(networkName)s", {networkName})}</span>
                    <span className="channel">{_t("Channel: %(channelName)s", {channelName})}</span>
                </p>
                <ul className="metadata">
                    {creator} {bot}
                </ul>
            </div>
        </li>);
    }
}
