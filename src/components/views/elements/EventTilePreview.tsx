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
import classnames from 'classnames';
import { MatrixEvent } from 'matrix-js-sdk/src/models/event';

import * as Avatar from '../../../Avatar';
import { MatrixClientPeg } from '../../../MatrixClientPeg';
import EventTile from '../rooms/EventTile';
import SettingsStore from "../../../settings/SettingsStore";
import {Layout} from "../../../settings/Layout";
import {UIFeature} from "../../../settings/UIFeature";
import {replaceableComponent} from "../../../utils/replaceableComponent";

interface IProps {
    /**
     * The text to be displayed in the message preview
     */
    message: string;

    /**
     * Whether to use the irc layout or not
     */
    layout: Layout;

    /**
     * classnames to apply to the wrapper of the preview
     */
    className: string;
}

/* eslint-disable camelcase */
interface IState {
    userId: string;
    displayname: string;
    avatar_url: string;
}
/* eslint-enable camelcase */

const AVATAR_SIZE = 32;

@replaceableComponent("views.elements.EventTilePreview")
export default class EventTilePreview extends React.Component<IProps, IState> {
    constructor(props: IProps) {
        super(props);

        this.state = {
            userId: "@erim:fink.fink",
            displayname: "Erimayas Fink",
            avatar_url: null,
        };
    }

    async componentDidMount() {
        // Fetch current user data
        const client = MatrixClientPeg.get();
        const userId = client.getUserId();
        const profileInfo = await client.getProfileInfo(userId);
        const avatarUrl = profileInfo.avatar_url;

        this.setState({
            userId,
            displayname: profileInfo.displayname,
            avatar_url: avatarUrl,
        });
    }

    private fakeEvent({userId, displayname, avatar_url: avatarUrl}: IState) {
        // Fake it till we make it
        /* eslint-disable quote-props */
        const rawEvent = {
            type: "m.room.message",
            sender: userId,
            content: {
                "m.new_content": {
                    msgtype: "m.text",
                    body: this.props.message,
                    displayname: displayname,
                    avatar_url: avatarUrl,
                },
                msgtype: "m.text",
                body: this.props.message,
                displayname: displayname,
                avatar_url: avatarUrl,
            },
            unsigned: {
                age: 97,
            },
            event_id: "$9999999999999999999999999999999999999999999",
            room_id: "!999999999999999999:example.org",
        };
        const event = new MatrixEvent(rawEvent);
        /* eslint-enable quote-props */

        // Fake it more
        event.sender = {
            name: displayname,
            userId: userId,
            getAvatarUrl: (..._) => {
                return Avatar.avatarUrlForUser({avatarUrl}, AVATAR_SIZE, AVATAR_SIZE, "crop");
            },
            getMxcAvatarUrl: () => avatarUrl,
        };

        return event;
    }

    public render() {
        const event = this.fakeEvent(this.state);

        const className = classnames(this.props.className, {
            "mx_IRCLayout": this.props.layout == Layout.IRC,
            "mx_GroupLayout": this.props.layout == Layout.Group,
        });

        return <div className={className}>
            <EventTile
                mxEvent={event}
                layout={this.props.layout}
                enableFlair={SettingsStore.getValue(UIFeature.Flair)}
            />
        </div>;
    }
}
