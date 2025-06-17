/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX, type ReactNode } from "react";
import classNames from "classnames";
import { type RoomMember, type Room } from "matrix-js-sdk/src/matrix";
import { MenuItem } from "@vector-im/compound-web";
import CloseIcon from "@vector-im/compound-design-tokens/assets/web/icons/close";
import ChatProblemIcon from "@vector-im/compound-design-tokens/assets/web/icons/chat-problem";
import VisibilityOffIcon from "@vector-im/compound-design-tokens/assets/web/icons/visibility-off";
import LeaveIcon from "@vector-im/compound-design-tokens/assets/web/icons/leave";

import { _t } from "../../../../languageHandler";
import { type IPowerLevelsContent } from "../UserInfo";
import { useUserInfoAdminToolsContainerViewModel } from "../../../viewmodels/right_panel/user_info/admin/UserInfoAdminToolsContainerViewModel";
import { useMuteButtonViewModel } from "../../../viewmodels/right_panel/user_info/admin/UserInfoMuteButtonViewModel";
import { useBanButtonViewModel } from "../../../viewmodels/right_panel/user_info/admin/UserInfoBanButtonViewModel";
import { useRoomKickButtonViewModel } from "../../../viewmodels/right_panel/user_info/admin/UserInfoKickButtonViewModel";
import { useRedactMessagesButtonViewModel } from "../../../viewmodels/right_panel/user_info/admin/UserInfoRedactButtonViewModel";

const Container: React.FC<{
    children: ReactNode;
    className?: string;
}> = ({ children, className }) => {
    const classes = classNames("mx_UserInfo_container", className);
    return <div className={classes}>{children}</div>;
};

interface IBaseProps {
    member: RoomMember;
    isUpdating: boolean;
    startUpdating(): void;
    stopUpdating(): void;
}

export const RoomKickButton = ({
    room,
    member,
    isUpdating,
    startUpdating,
    stopUpdating,
}: Omit<IBaseRoomProps, "powerLevels">): JSX.Element | null => {
    const vm = useRoomKickButtonViewModel({ room, member, isUpdating, startUpdating, stopUpdating });
    // check if user can be kicked/disinvited
    if (!vm.canUserBeKicked) return <></>;

    return (
        <MenuItem
            role="button"
            onSelect={async (ev) => {
                ev.preventDefault();
                vm.onKickClick();
            }}
            disabled={isUpdating}
            label={vm.kickLabel}
            kind="critical"
            Icon={LeaveIcon}
        />
    );
};

const RedactMessagesButton: React.FC<IBaseProps> = ({ member }) => {
    const vm = useRedactMessagesButtonViewModel(member);

    return (
        <MenuItem
            role="button"
            onSelect={async (ev) => {
                ev.preventDefault();
                vm.onRedactAllMessagesClick();
            }}
            label={_t("user_info|redact_button")}
            kind="critical"
            Icon={CloseIcon}
        />
    );
};

export const BanToggleButton = ({
    room,
    member,
    isUpdating,
    startUpdating,
    stopUpdating,
}: Omit<IBaseRoomProps, "powerLevels">): JSX.Element => {
    const vm = useBanButtonViewModel({ room, member, isUpdating, startUpdating, stopUpdating });

    return (
        <MenuItem
            role="button"
            onSelect={async (ev) => {
                ev.preventDefault();
                vm.onBanOrUnbanClick();
            }}
            disabled={isUpdating}
            label={vm.banLabel}
            kind="critical"
            Icon={ChatProblemIcon}
        />
    );
};

interface IBaseRoomProps extends IBaseProps {
    room: Room;
    powerLevels: IPowerLevelsContent;
    children?: ReactNode;
}

// We do not show a Mute button for ourselves so it doesn't need to handle warning self demotion
const MuteToggleButton: React.FC<IBaseRoomProps> = ({
    member,
    room,
    powerLevels,
    isUpdating,
    startUpdating,
    stopUpdating,
}) => {
    const vm = useMuteButtonViewModel({ room, member, isUpdating, startUpdating, stopUpdating });
    // Don't show the mute/unmute option if the user is not in the room
    if (!vm.isMemberInTheRoom) return null;

    return (
        <MenuItem
            role="button"
            onSelect={async (ev) => {
                ev.preventDefault();
                vm.onMuteButtonClick();
            }}
            disabled={isUpdating}
            label={vm.muteLabel}
            kind="critical"
            Icon={VisibilityOffIcon}
        />
    );
};

export const UserInfoAdminToolsContainer: React.FC<IBaseRoomProps> = ({
    room,
    children,
    member,
    isUpdating,
    startUpdating,
    stopUpdating,
    powerLevels,
}) => {
    let kickButton;
    let banButton;
    let muteButton;
    let redactButton;

    const vm = useUserInfoAdminToolsContainerViewModel({ room, member, powerLevels });

    if (!vm.isCurrentUserInTheRoom) {
        // we aren't in the room, so return no admin tooling
        return <div />;
    }

    if (vm.shouldShowKickButton) {
        kickButton = (
            <RoomKickButton
                room={room}
                member={member}
                isUpdating={isUpdating}
                startUpdating={startUpdating}
                stopUpdating={stopUpdating}
            />
        );
    }
    if (vm.shouldShowRedactButton) {
        redactButton = (
            <RedactMessagesButton
                member={member}
                isUpdating={isUpdating}
                startUpdating={startUpdating}
                stopUpdating={stopUpdating}
            />
        );
    }
    if (vm.shouldShowBanButton) {
        banButton = (
            <BanToggleButton
                room={room}
                member={member}
                isUpdating={isUpdating}
                startUpdating={startUpdating}
                stopUpdating={stopUpdating}
            />
        );
    }
    if (vm.shouldShowMuteButton) {
        muteButton = (
            <MuteToggleButton
                member={member}
                room={room}
                powerLevels={powerLevels}
                isUpdating={isUpdating}
                startUpdating={startUpdating}
                stopUpdating={stopUpdating}
            />
        );
    }

    if (kickButton || banButton || muteButton || redactButton || children) {
        return (
            <Container>
                {muteButton}
                {redactButton}
                {kickButton}
                {banButton}
                {children}
            </Container>
        );
    }

    return <div />;
};
