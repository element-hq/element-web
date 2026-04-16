/*
 Copyright 2026 Element Creations Ltd.

 SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 Please see LICENSE files in the repository root for full details.
 */

import React from "react";
import { RichItem } from "@element-hq/web-shared-components";

import { type Member, type ThreepidMember } from "../../../../utils/direct-messages.ts";
import type { ButtonEvent } from "../../elements/AccessibleButton.tsx";
import BaseAvatar from "../../avatars/BaseAvatar.tsx";
import { mediaFromMxc } from "../../../../customisations/Media.ts";
import UserIdentifierCustomisations from "../../../../customisations/UserIdentifier.ts";
import { _t } from "../../../../languageHandler.tsx";
import { Icon as EmailPillAvatarIcon } from "../../../../../res/img/icon-email-pill-avatar.svg";

interface IDMRoomTileProps {
    member: Member;
    lastActiveTs?: number;
    onToggle(member: Member): void;
    isSelected: boolean;
}

/** A tile representing a single user in the "suggestions"/"recents" section of the invite dialog. */
export class DMRoomTile extends React.PureComponent<IDMRoomTileProps> {
    private onClick = (e: ButtonEvent): void => {
        // Stop the browser from highlighting text
        e.preventDefault();
        e.stopPropagation();

        this.props.onToggle(this.props.member);
    };

    public render(): React.ReactNode {
        const avatarSize = "32px";
        const avatar = (this.props.member as ThreepidMember).isEmail ? (
            <EmailPillAvatarIcon width={avatarSize} height={avatarSize} />
        ) : (
            <BaseAvatar
                url={
                    this.props.member.getMxcAvatarUrl()
                        ? mediaFromMxc(this.props.member.getMxcAvatarUrl()!).getSquareThumbnailHttp(
                              parseInt(avatarSize, 10),
                          )
                        : null
                }
                name={this.props.member.name}
                idName={this.props.member.userId}
                size={avatarSize}
            />
        );

        const userIdentifier = UserIdentifierCustomisations.getDisplayUserIdentifier(this.props.member.userId, {
            withDisplayName: true,
        });

        const caption = (this.props.member as ThreepidMember).isEmail
            ? _t("invite|email_caption")
            : userIdentifier || this.props.member.userId;

        return (
            <RichItem
                avatar={avatar}
                title={this.props.member.name}
                description={caption}
                timestamp={this.props.lastActiveTs}
                onClick={this.onClick}
                selected={this.props.isSelected}
            />
        );
    }
}
