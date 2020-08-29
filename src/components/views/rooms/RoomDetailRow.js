/*
Copyright 2017 New Vector Ltd.

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

import * as sdk from '../../../index';
import React, {createRef} from 'react';
import { _t } from '../../../languageHandler';
import { linkifyElement } from '../../../HtmlUtils';
import {MatrixClientPeg} from '../../../MatrixClientPeg';
import PropTypes from 'prop-types';
import {getHttpUriForMxc} from "matrix-js-sdk/src/content-repo";

export function getDisplayAliasForRoom(room) {
    return room.canonicalAlias || (room.aliases ? room.aliases[0] : "");
}

export const roomShape = PropTypes.shape({
    name: PropTypes.string,
    topic: PropTypes.string,
    roomId: PropTypes.string,
    avatarUrl: PropTypes.string,
    numJoinedMembers: PropTypes.number,
    canonicalAlias: PropTypes.string,
    aliases: PropTypes.arrayOf(PropTypes.string),

    worldReadable: PropTypes.bool,
    guestCanJoin: PropTypes.bool,
});

export default class RoomDetailRow extends React.Component {
    static propTypes = {
        room: roomShape,
        // passes ev, room as args
        onClick: PropTypes.func,
        onMouseDown: PropTypes.func,
    };

    constructor(props) {
        super(props);

        this._topic = createRef();
    }

    componentDidMount() {
        this._linkifyTopic();
    }

    componentDidUpdate() {
        this._linkifyTopic();
    }

    _linkifyTopic() {
        if (this._topic.current) {
            linkifyElement(this._topic.current);
        }
    }

    onClick = (ev) => {
        ev.preventDefault();
        if (this.props.onClick) {
            this.props.onClick(ev, this.props.room);
        }
    };

    onTopicClick = (ev) => {
        // When clicking a link in the topic, prevent the event being propagated
        // to `onClick`.
        ev.stopPropagation();
    };

    render() {
        const BaseAvatar = sdk.getComponent('avatars.BaseAvatar');

        const room = this.props.room;
        const name = room.name || getDisplayAliasForRoom(room) || _t('Unnamed room');

        const guestRead = room.worldReadable ? (
                <div className="mx_RoomDirectory_perm">{ _t('World readable') }</div>
            ) : <div />;
        const guestJoin = room.guestCanJoin ? (
                <div className="mx_RoomDirectory_perm">{ _t('Guests can join') }</div>
            ) : <div />;

        const perms = (guestRead || guestJoin) ? (<div className="mx_RoomDirectory_perms">
            { guestRead }&nbsp;
            { guestJoin }
        </div>) : <div />;

        return <tr key={room.roomId} onClick={this.onClick} onMouseDown={this.props.onMouseDown}>
            <td className="mx_RoomDirectory_roomAvatar">
                <BaseAvatar width={24} height={24} resizeMethod='crop'
                    name={name} idName={name}
                    url={getHttpUriForMxc(
                            MatrixClientPeg.get().getHomeserverUrl(),
                            room.avatarUrl, 24, 24, "crop")} />
            </td>
            <td className="mx_RoomDirectory_roomDescription">
                <div className="mx_RoomDirectory_name">{ name }</div>&nbsp;
                { perms }
                <div className="mx_RoomDirectory_topic" ref={this._topic} onClick={this.onTopicClick}>
                    { room.topic }
                </div>
                <div className="mx_RoomDirectory_alias">{ getDisplayAliasForRoom(room) }</div>
            </td>
            <td className="mx_RoomDirectory_roomMemberCount">
                { room.numJoinedMembers }
            </td>
        </tr>;
    }
}
