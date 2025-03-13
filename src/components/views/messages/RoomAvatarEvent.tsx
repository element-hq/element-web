/*
Copyright 2024 New Vector Ltd.
Copyright 2019 Michael Telatynski <7t3chguy@gmail.com>
Copyright 2019 The Matrix.org Foundation C.I.C.
Copyright 2017 Vector Creations Ltd

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { type MatrixEvent } from "matrix-js-sdk/src/matrix";

import { MatrixClientPeg } from "../../../MatrixClientPeg";
import { _t } from "../../../languageHandler";
import Modal from "../../../Modal";
import AccessibleButton from "../elements/AccessibleButton";
import { mediaFromMxc } from "../../../customisations/Media";
import RoomAvatar from "../avatars/RoomAvatar";
import ImageView from "../elements/ImageView";
interface IProps {
    /* the MatrixEvent to show */
    mxEvent: MatrixEvent;
}

export default class RoomAvatarEvent extends React.Component<IProps> {
    private onAvatarClick = (): void => {
        const cli = MatrixClientPeg.safeGet();
        const ev = this.props.mxEvent;
        const httpUrl = mediaFromMxc(ev.getContent().url).srcHttp;
        if (!httpUrl) return;

        const room = cli.getRoom(this.props.mxEvent.getRoomId());
        const text = _t("timeline|m.room.avatar|lightbox_title", {
            senderDisplayName: ev.sender && ev.sender.name ? ev.sender.name : ev.getSender(),
            roomName: room ? room.name : "",
        });

        const params = {
            src: httpUrl,
            name: text,
        };
        Modal.createDialog(ImageView, params, "mx_Dialog_lightbox", undefined, true);
    };

    public render(): React.ReactNode {
        const ev = this.props.mxEvent;
        const senderDisplayName = ev.sender && ev.sender.name ? ev.sender.name : ev.getSender();

        if (!ev.getContent().url || ev.getContent().url.trim().length === 0) {
            return <div className="mx_TextualEvent">{_t("timeline|m.room.avatar|removed", { senderDisplayName })}</div>;
        }

        const room = MatrixClientPeg.safeGet().getRoom(ev.getRoomId());
        // Provide all arguments to RoomAvatar via oobData because the avatar is historic
        const oobData = {
            avatarUrl: ev.getContent().url,
            name: room ? room.name : "",
        };

        return (
            <>
                {_t(
                    "timeline|m.room.avatar|changed_img",
                    { senderDisplayName: senderDisplayName },
                    {
                        img: () => (
                            <AccessibleButton
                                key="avatar"
                                className="mx_RoomAvatarEvent_avatar"
                                onClick={this.onAvatarClick}
                            >
                                <RoomAvatar size="14px" oobData={oobData} />
                            </AccessibleButton>
                        ),
                    },
                )}
            </>
        );
    }
}
