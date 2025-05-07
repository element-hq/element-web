/*
Copyright 2024 New Vector Ltd.
Copyright 2020 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import classnames from "classnames";
import { MatrixEvent, type RoomMember, MsgType } from "matrix-js-sdk/src/matrix";

import * as Avatar from "../../../Avatar";
import EventTile from "../rooms/EventTile";
import { Layout } from "../../../settings/enums/Layout";
import Spinner from "./Spinner";

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
    className?: string;

    /**
     * The ID of the displayed user
     */
    userId?: string;

    /**
     * The display name of the displayed user
     */
    displayName?: string;

    /**
     * The mxc:// avatar URL of the displayed user
     */
    avatarUrl?: string;
}

interface IState {
    message: string;
}

const AVATAR_SIZE = 32;

export default class EventTilePreview extends React.Component<IProps, IState> {
    public constructor(props: IProps) {
        super(props);
        this.state = {
            message: props.message,
        };
    }

    private fakeEvent({ message }: IState): MatrixEvent {
        // Fake it till we make it
        /* eslint-disable quote-props */
        const rawEvent = {
            type: "m.room.message",
            sender: this.props.userId,
            content: {
                "m.new_content": {
                    msgtype: MsgType.Text,
                    body: message,
                    displayname: this.props.displayName,
                    avatar_url: this.props.avatarUrl,
                },
                "msgtype": MsgType.Text,
                "body": message,
                "displayname": this.props.displayName,
                "avatar_url": this.props.avatarUrl,
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
            name: this.props.displayName || this.props.userId,
            rawDisplayName: this.props.displayName,
            userId: this.props.userId,
            getAvatarUrl: (..._) => {
                return Avatar.avatarUrlForUser({ avatarUrl: this.props.avatarUrl }, AVATAR_SIZE, AVATAR_SIZE, "crop");
            },
            getMxcAvatarUrl: () => this.props.avatarUrl,
        } as RoomMember;

        return event;
    }

    public render(): React.ReactNode {
        const className = classnames(this.props.className, {
            mx_IRCLayout: this.props.layout == Layout.IRC,
            mx_EventTilePreview_loader: !this.props.userId,
        });

        if (!this.props.userId)
            return (
                <div className={className}>
                    <Spinner />
                </div>
            );

        const event = this.fakeEvent(this.state);

        return (
            <div className={className} role="presentation">
                <EventTile mxEvent={event} layout={this.props.layout} as="div" hideTimestamp inhibitInteraction />
            </div>
        );
    }
}
