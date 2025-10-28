/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

/**
 * @file Devtool for viewing room members and their devices.
 */

import React, { type JSX, useContext, useState } from "react";
import { type Device, type RoomMember } from "matrix-js-sdk/src/matrix";
import { type CryptoApi } from "matrix-js-sdk/src/crypto-api";

import { _t } from "../../../../languageHandler";
import BaseTool, { DevtoolsContext, type IDevtoolsProps } from "./BaseTool";
import FilteredList from "./FilteredList";
import LabelledToggleSwitch from "../../elements/LabelledToggleSwitch";
import { useAsyncMemo } from "../../../../hooks/useAsyncMemo";
import CopyableText from "../../elements/CopyableText";
import E2EIcon from "../../rooms/E2EIcon";
import { E2EStatus } from "../../../../utils/ShieldUtils";

/**
 * Replacement function for `<i>` tags in translation strings.
 */
function i(sub: string): JSX.Element {
    return <i>{sub}</i>;
}

/**
 * Shows a list of users in the room, and allows selecting a user to view.
 *
 * Initially, filters to only show joined users, but offers the user an option to show all users.
 *
 * Once the user chooses a specific member, delegates to {@link UserView} to view a single user.
 */
export const UserList: React.FC<Pick<IDevtoolsProps, "onBack">> = ({ onBack }) => {
    const context = useContext(DevtoolsContext);
    const [query, setQuery] = useState("");
    // Show only joined users or all users with member events?
    const [showOnlyJoined, setShowOnlyJoined] = useState(true);
    // The `RoomMember` for the selected user (if any)
    const [member, setMember] = useState<RoomMember | null>(null);

    if (member) {
        return <UserView member={member} onBack={() => setMember(null)} />;
    }

    const members = showOnlyJoined ? context.room.getJoinedMembers() : context.room.getMembers();

    return (
        <BaseTool onBack={onBack}>
            <FilteredList query={query} onChange={setQuery}>
                {members.map((member) => (
                    <UserButton key={member.userId} member={member} onClick={() => setMember(member)} />
                ))}
            </FilteredList>
            <LabelledToggleSwitch
                label={_t("devtools|only_joined_members")}
                onChange={setShowOnlyJoined}
                value={showOnlyJoined}
            />
        </BaseTool>
    );
};

interface UserButtonProps {
    member: RoomMember;
    onClick(): void;
}

/**
 * Button to select a user to view.
 */
const UserButton: React.FC<UserButtonProps> = ({ member, onClick }) => {
    return (
        <button className="mx_DevTools_button" onClick={onClick}>
            {member.userId}
        </button>
    );
};

interface UserProps extends Pick<IDevtoolsProps, "onBack"> {
    member: RoomMember;
}

/**
 * Shows a single user to view, and allows selecting a device to view.
 *
 * Once the user chooses a specific device, delegates to {@link DeviceView} to show a single device.
 */
const UserView: React.FC<UserProps> = ({ member, onBack }) => {
    const context = useContext(DevtoolsContext);
    const crypto = context.room.client.getCrypto();
    // An element to show the verification status of the device (unknown,
    // unverified, verified by cross signing, signed by owner).  The element
    // will show text as well as an icon.  If crypto is not available, the value
    // will be `null`.
    const verificationStatus = useAsyncMemo(
        async () => {
            if (!crypto) {
                return null;
            }
            const status = await crypto.getUserVerificationStatus(member.userId);
            if (status.isCrossSigningVerified()) {
                const e2eIcon = (): JSX.Element => (
                    <E2EIcon
                        isUser={true}
                        hideTooltip={true}
                        status={E2EStatus.Verified}
                        className="mx_E2EIcon_inline"
                    />
                );
                return _t("devtools|user_verification_status|verified", {}, { E2EIcon: e2eIcon });
            } else if (status.wasCrossSigningVerified()) {
                const e2eIcon = (): JSX.Element => (
                    <E2EIcon
                        isUser={true}
                        hideTooltip={true}
                        status={E2EStatus.Warning}
                        className="mx_E2EIcon_inline"
                    />
                );
                return _t("devtools|user_verification_status|was_verified", {}, { E2EIcon: e2eIcon });
            } else if (status.needsUserApproval) {
                const e2eIcon = (): JSX.Element => (
                    <E2EIcon
                        isUser={true}
                        hideTooltip={true}
                        status={E2EStatus.Warning}
                        className="mx_E2EIcon_inline"
                    />
                );
                return _t("devtools|user_verification_status|identity_changed", {}, { E2EIcon: e2eIcon });
            } else {
                const e2eIcon = (): JSX.Element => (
                    <E2EIcon isUser={true} hideTooltip={true} status={E2EStatus.Normal} className="mx_E2EIcon_inline" />
                );
                return _t("devtools|user_verification_status|unverified", {}, { E2EIcon: e2eIcon });
            }
        },
        [context, member],
        _t("common|loading"),
    );
    // The user's devices, as a Map from device ID to device information (see
    // the `Device` type in `matrix-js-sdk/src/models/device.ts`).
    const devices = useAsyncMemo(
        async () => {
            const devices = await crypto?.getUserDeviceInfo([member.userId]);
            return devices?.get(member.userId) ?? new Map();
        },
        [context, member],
        new Map(),
    );
    // The device to show, if any.
    const [device, setDevice] = useState<Device | null>(null);

    if (device) {
        return <DeviceView crypto={crypto!} device={device} onBack={() => setDevice(null)} />;
    }

    const avatarUrl = member.getMxcAvatarUrl();
    const memberEventContent = member.events.member?.getContent();

    return (
        <BaseTool onBack={onBack}>
            <ul>
                <li>
                    <CopyableText getTextToCopy={() => member.userId} border={false}>
                        {_t("devtools|user_id", { userId: member.userId })}
                    </CopyableText>
                </li>
                <li>{_t("devtools|user_room_membership", { membership: member.membership ?? "leave" })}</li>
                <li>
                    {memberEventContent && "displayname" in memberEventContent
                        ? _t("devtools|user_displayname", { displayname: member.rawDisplayName })
                        : _t("devtools|user_no_displayname", {}, { i })}
                </li>
                <li>
                    {avatarUrl !== undefined ? (
                        <CopyableText getTextToCopy={() => avatarUrl} border={false}>
                            {_t("devtools|user_avatar", { avatar: avatarUrl })}
                        </CopyableText>
                    ) : (
                        _t("devtools|user_no_avatar", {}, { i })
                    )}
                </li>
                <li>{verificationStatus}</li>
            </ul>
            <section>
                <h2>{_t("devtools|devices", { count: devices.size })}</h2>
                <ul>
                    {Array.from(devices.values()).map((device) => (
                        <li key={device.deviceId}>
                            <DeviceButton crypto={crypto!} device={device} onClick={() => setDevice(device)} />
                        </li>
                    ))}
                </ul>
            </section>
        </BaseTool>
    );
};

interface DeviceButtonProps {
    crypto: CryptoApi;
    device: Device;
    onClick(): void;
}

/**
 * Button to select a user to view.
 */
const DeviceButton: React.FC<DeviceButtonProps> = ({ crypto, device, onClick }) => {
    const verificationIcon = useAsyncMemo(
        async () => {
            const status = await crypto.getDeviceVerificationStatus(device.userId, device.deviceId);
            if (!status) {
                return;
            } else if (status.crossSigningVerified) {
                return (
                    <E2EIcon
                        isUser={true}
                        hideTooltip={true}
                        status={E2EStatus.Verified}
                        className="mx_E2EIcon_inline"
                    />
                );
            } else if (status.signedByOwner) {
                return (
                    <E2EIcon isUser={true} hideTooltip={true} status={E2EStatus.Normal} className="mx_E2EIcon_inline" />
                );
            } else {
                return (
                    <E2EIcon
                        isUser={true}
                        hideTooltip={true}
                        status={E2EStatus.Warning}
                        className="mx_E2EIcon_inline"
                    />
                );
            }
        },
        [crypto, device],
        null,
    );
    return (
        <button className="mx_DevTools_button" onClick={onClick}>
            {verificationIcon}
            {device.deviceId}
        </button>
    );
};

interface DeviceProps extends Pick<IDevtoolsProps, "onBack"> {
    crypto: CryptoApi;
    device: Device;
}

/**
 * Show a single device to view.
 */
const DeviceView: React.FC<DeviceProps> = ({ crypto, device, onBack }) => {
    // An element to show the verification status of the device (unknown,
    // unverified, verified by cross signing, signed by owner).  The element
    // will show text as well as an icon if applicable.
    const verificationStatus = useAsyncMemo(
        async () => {
            const status = await crypto.getDeviceVerificationStatus(device.userId, device.deviceId);
            if (!status) {
                // `status` will be `null` if the device is unknown or if the
                // device doesn't have device keys.  In either case, it's not a
                // security issue since we won't be sending it decryption keys.
                return _t("devtools|device_verification_status|unknown");
            } else if (status.crossSigningVerified) {
                const e2eIcon = (): JSX.Element => (
                    <E2EIcon
                        isUser={true}
                        hideTooltip={true}
                        status={E2EStatus.Verified}
                        className="mx_E2EIcon_inline"
                    />
                );
                return _t("devtools|device_verification_status|verified", {}, { E2EIcon: e2eIcon });
            } else if (status.signedByOwner) {
                const e2eIcon = (): JSX.Element => (
                    <E2EIcon isUser={true} hideTooltip={true} status={E2EStatus.Normal} className="mx_E2EIcon_inline" />
                );
                return _t("devtools|device_verification_status|signed_by_owner", {}, { E2EIcon: e2eIcon });
            } else {
                const e2eIcon = (): JSX.Element => (
                    <E2EIcon
                        isUser={true}
                        hideTooltip={true}
                        status={E2EStatus.Warning}
                        className="mx_E2EIcon_inline"
                    />
                );
                return _t("devtools|device_verification_status|unverified", {}, { E2EIcon: e2eIcon });
            }
        },
        [crypto, device],
        _t("common|loading"),
    );

    const keyIdSuffix = ":" + device.deviceId;
    const deviceKeys = (
        <ul>
            {Array.from(device.keys.entries()).map(([keyId, key]) => {
                if (keyId.endsWith(keyIdSuffix)) {
                    return (
                        <li key={keyId}>
                            <CopyableText getTextToCopy={() => key} border={false}>
                                {keyId.slice(0, -keyIdSuffix.length)}: {key}
                            </CopyableText>
                        </li>
                    );
                } else {
                    return (
                        <li key={keyId}>
                            <i>{_t("devtools|invalid_device_key_id")}</i>: {keyId}: {key}
                        </li>
                    );
                }
            })}
        </ul>
    );

    return (
        <BaseTool onBack={onBack}>
            <ul>
                <li>
                    <CopyableText getTextToCopy={() => device.userId} border={false}>
                        {_t("devtools|user_id", { userId: device.userId })}
                    </CopyableText>
                </li>
                <li>
                    <CopyableText getTextToCopy={() => device.deviceId} border={false}>
                        {_t("devtools|device_id", { deviceId: device.deviceId })}
                    </CopyableText>
                </li>
                <li>
                    {"displayName" in device
                        ? _t("devtools|user_displayname", { displayname: device.displayName })
                        : _t("devtools|user_no_displayname", {}, { i })}
                </li>
                <li>{verificationStatus}</li>
                <li>
                    {device.dehydrated ? _t("devtools|device_dehydrated_yes") : _t("devtools|device_dehydrated_no")}
                </li>
                <li>
                    {_t("devtools|device_keys")}
                    {deviceKeys}
                </li>
            </ul>
        </BaseTool>
    );
};
