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

import React from 'react';
import PropTypes from 'prop-types';
import {getHttpUriForMxc} from "matrix-js-sdk/src/content-repo";
import {_t} from "../../../languageHandler";
import {MatrixClientPeg} from "../../../MatrixClientPeg";
import Pill from "../elements/Pill";
import {makeUserPermalink} from "../../../utils/permalinks/Permalinks";
import BaseAvatar from "../avatars/BaseAvatar";
import AccessibleButton from "../elements/AccessibleButton";
import {replaceableComponent} from "../../../utils/replaceableComponent";

@replaceableComponent("views.settings.BridgeTile")
export default class BridgeTile extends React.PureComponent {
    static propTypes = {
        ev: PropTypes.object.isRequired,
        room: PropTypes.object.isRequired,
    }

    state = {
        visible: false,
    }

    _toggleVisible() {
        this.setState({
            visible: !this.state.visible,
        });
    }

    render() {
        const content = this.props.ev.getContent();
        const { channel, network, protocol } = content;
        const protocolName = protocol.displayname || protocol.id;
        const channelName = channel.displayname || channel.id;
        const networkName = network ? network.displayname || network.id : protocolName;

        let creator = null;
        if (content.creator) {
            creator = _t("This bridge was provisioned by <user />.", {}, {
                    user: <Pill
                        type={Pill.TYPE_USER_MENTION}
                        room={this.props.room}
                        url={makeUserPermalink(content.creator)}
                        shouldShowPillAvatar={true}
                    />,
            });
        }

        const bot = _t("This bridge is managed by <user />.", {}, {
            user: <Pill
                type={Pill.TYPE_USER_MENTION}
                room={this.props.room}
                url={makeUserPermalink(this.props.ev.getSender())}
                shouldShowPillAvatar={true}
                />,
        });

        let networkIcon;

        if (protocol.avatar) {
            const avatarUrl = getHttpUriForMxc(
                MatrixClientPeg.get().getHomeserverUrl(),
                protocol.avatar, 64, 64, "crop",
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
            networkIcon = <div class="noProtocolIcon"></div>;
        }

        const id = this.props.ev.getId();
        const metadataClassname = "metadata" + (this.state.visible ? " visible" : "");
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
                <p className={metadataClassname}>
                    {creator} {bot}
                </p>
                <AccessibleButton className="mx_showMore" kind="secondary" onClick={this._toggleVisible.bind(this)}>
                    { this.state.visible ? _t("Show less") : _t("Show more") }
                </AccessibleButton>
            </div>
        </li>);
    }
}
