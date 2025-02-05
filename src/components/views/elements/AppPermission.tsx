/*
Copyright 2024 New Vector Ltd.
Copyright 2019, 2020 The Matrix.org Foundation C.I.C.
Copyright 2018, 2019 New Vector Ltd
Copyright 2017 Vector Creations Ltd

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { type RoomMember } from "matrix-js-sdk/src/matrix";
import { Tooltip } from "@vector-im/compound-web";
import { HelpIcon } from "@vector-im/compound-design-tokens/assets/web/icons";

import { _t } from "../../../languageHandler";
import SdkConfig from "../../../SdkConfig";
import WidgetUtils from "../../../utils/WidgetUtils";
import { MatrixClientPeg } from "../../../MatrixClientPeg";
import MemberAvatar from "../avatars/MemberAvatar";
import BaseAvatar from "../avatars/BaseAvatar";
import Heading from "../typography/Heading";
import AccessibleButton from "./AccessibleButton";
import { parseUrl } from "../../../utils/UrlUtils";

interface IProps {
    url: string;
    creatorUserId: string;
    roomId: string;
    onPermissionGranted: () => void;
    isRoomEncrypted?: boolean;
}

interface IState {
    roomMember: RoomMember | null;
    isWrapped: boolean;
    widgetDomain: string | null;
}

export default class AppPermission extends React.Component<IProps, IState> {
    public static defaultProps: Partial<IProps> = {
        onPermissionGranted: () => {},
    };

    public constructor(props: IProps) {
        super(props);

        // The first step is to pick apart the widget so we can render information about it
        const urlInfo = this.parseWidgetUrl();

        // The second step is to find the user's profile so we can show it on the prompt
        const room = MatrixClientPeg.safeGet().getRoom(this.props.roomId);
        let roomMember: RoomMember | null = null;
        if (room) roomMember = room.getMember(this.props.creatorUserId);

        // Set all this into the initial state
        this.state = {
            roomMember,
            ...urlInfo,
        };
    }

    private parseWidgetUrl(): { isWrapped: boolean; widgetDomain: string | null } {
        const widgetUrl = parseUrl(this.props.url);

        // HACK: We're relying on the query params when we should be relying on the widget's `data`.
        // This is a workaround for Scalar.
        if (WidgetUtils.isScalarUrl(this.props.url) && widgetUrl.searchParams.has("url")) {
            const unwrappedUrl = parseUrl(widgetUrl.searchParams.get("url")!);
            return {
                widgetDomain: unwrappedUrl.host || unwrappedUrl.hostname,
                isWrapped: true,
            };
        } else {
            return {
                widgetDomain: widgetUrl.host || widgetUrl.hostname,
                isWrapped: false,
            };
        }
    }

    public render(): React.ReactNode {
        const brand = SdkConfig.get().brand;

        const displayName = this.state.roomMember ? this.state.roomMember.name : this.props.creatorUserId;
        const userId = displayName === this.props.creatorUserId ? null : this.props.creatorUserId;

        const avatar = this.state.roomMember ? (
            <MemberAvatar member={this.state.roomMember} size="38px" />
        ) : (
            <BaseAvatar name={this.props.creatorUserId} size="38px" />
        );

        const warningTooltip = (
            <Tooltip
                label={_t("analytics|shared_data_heading")}
                caption={
                    <ul>
                        <li>{_t("widget|shared_data_name")}</li>
                        <li>{_t("widget|shared_data_avatar")}</li>
                        <li>{_t("widget|shared_data_mxid")}</li>
                        <li>{_t("widget|shared_data_device_id")}</li>
                        <li>{_t("widget|shared_data_theme")}</li>
                        <li>{_t("widget|shared_data_lang")}</li>
                        <li>{_t("widget|shared_data_url", { brand })}</li>
                        <li>{_t("widget|shared_data_room_id")}</li>
                        <li>{_t("widget|shared_data_widget_id")}</li>
                    </ul>
                }
            >
                <div className="mx_TextWithTooltip_target mx_TextWithTooltip_target--helpIcon">
                    <HelpIcon className="mx_Icon mx_Icon_12" />
                </div>
            </Tooltip>
        );

        // Due to i18n limitations, we can't dedupe the code for variables in these two messages.
        const warning = this.state.isWrapped
            ? _t(
                  "widget|shared_data_warning_im",
                  { widgetDomain: this.state.widgetDomain },
                  { helpIcon: () => warningTooltip },
              )
            : _t(
                  "widget|shared_data_warning",
                  { widgetDomain: this.state.widgetDomain },
                  { helpIcon: () => warningTooltip },
              );

        const encryptionWarning = this.props.isRoomEncrypted ? _t("widget|unencrypted_warning") : null;

        return (
            <div className="mx_AppPermission">
                <div className="mx_AppPermission_content">
                    <div className="mx_AppPermission_content_bolder">{_t("widget|added_by")}</div>
                    <div>
                        {avatar}
                        <Heading size="4">{displayName}</Heading>
                        <div>{userId}</div>
                    </div>
                    <div>{warning}</div>
                    <div>
                        {_t("widget|cookie_warning")}&nbsp;{encryptionWarning}
                    </div>
                    <div>
                        <AccessibleButton kind="primary_sm" onClick={this.props.onPermissionGranted}>
                            {_t("action|continue")}
                        </AccessibleButton>
                    </div>
                </div>
            </div>
        );
    }
}
