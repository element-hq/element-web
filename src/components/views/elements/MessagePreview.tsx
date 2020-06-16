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

import { MatrixClientPeg } from '../../../MatrixClientPeg';

import React from 'react';

import * as Avatar from '../../../Avatar';
import classnames from 'classnames';
import { MatrixEvent } from 'matrix-js-sdk/src/models/Event';
import * as sdk from "../../../index";

interface IProps {
    /**
     * The text to be displayed in the message preview
     */
    message: string;

    /**
     * Whether to use the irc layout or not
     */
    useIRCLayout: boolean;

    /**
     * classnames to apply to the wrapper of the preview
     */
    className: string;
}

interface IState {
    userId: string;
    displayname: string,
    avatar_url: string,
}

const AVATAR_SIZE = 32;

export default class MessagePreview extends React.Component<IProps, IState> {
    constructor(props: IProps) {
        super(props);

        this.state = {
            userId: "@erim:fink.fink",
            displayname: "Erimayas Fink",
            avatar_url: null,
        }
    }

    async componentDidMount() {
        // Fetch current user data
        const client = MatrixClientPeg.get()
        const userId = await client.getUserId();
        const profileInfo = await client.getProfileInfo(userId);
        const avatar_url = Avatar.avatarUrlForUser(
            {avatarUrl: profileInfo.avatar_url},
            AVATAR_SIZE, AVATAR_SIZE, "crop");

        this.setState({
            userId,
            displayname: profileInfo.displayname,
            avatar_url,
        });

    }

    public render() {
        const EventTile = sdk.getComponent("views.rooms.EventTile");

        // Fake it till we make it
        const event = new MatrixEvent(JSON.parse(`{
                "type": "m.room.message",
                "sender": "${this.state.userId}",
                "content": {
                  "m.new_content": {
                    "msgtype": "m.text",
                    "body": "${this.props.message}",
                    "displayname": "${this.state.displayname}",
                    "avatar_url": "${this.state.avatar_url}"
                  },
                  "msgtype": "m.text",
                  "body": "${this.props.message}",
                  "displayname": "${this.state.displayname}",
                  "avatar_url": "${this.state.avatar_url}"
                },
                "unsigned": {
                  "age": 97
                },
                "event_id": "$9999999999999999999999999999999999999999999",
                "room_id": "!999999999999999999:matrix.org"
              }`))

        // Fake it more
        event.sender = {
            name: this.state.displayname,
            userId: this.state.userId,
            getAvatarUrl: (..._) => {
                return this.state.avatar_url;
            },
        }

        let className = classnames(
            this.props.className,
            {
                "mx_IRCLayout": this.props.useIRCLayout,
                "mx_GroupLayout": !this.props.useIRCLayout,
            }
        );

        return <div className={className} >
            <EventTile mxEvent={event} useIRCLayout={this.props.useIRCLayout} />
        </div>
    }
}
