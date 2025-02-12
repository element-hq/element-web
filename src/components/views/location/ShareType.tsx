/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type HTMLAttributes, useContext } from "react";
import LocationIcon from "@vector-im/compound-design-tokens/assets/web/icons/location-pin-solid";

import MatrixClientContext from "../../../contexts/MatrixClientContext";
import { _t } from "../../../languageHandler";
import { OwnProfileStore } from "../../../stores/OwnProfileStore";
import BaseAvatar from "../avatars/BaseAvatar";
import AccessibleButton, { type ButtonEvent } from "../elements/AccessibleButton";
import Heading from "../typography/Heading";
import { LocationShareType } from "./shareLocation";
import StyledLiveBeaconIcon from "../beacon/StyledLiveBeaconIcon";

const UserAvatar: React.FC = () => {
    const matrixClient = useContext(MatrixClientContext);
    const userId = matrixClient.getSafeUserId();
    const displayName = OwnProfileStore.instance.displayName ?? undefined;
    // 40 - 2px border
    const avatarSize = "36px";
    const avatarUrl = OwnProfileStore.instance.getHttpAvatarUrl(parseInt(avatarSize, 10)) ?? undefined;

    return (
        <div className={`mx_ShareType_option-icon ${LocationShareType.Own}`}>
            <BaseAvatar
                idName={userId}
                name={displayName}
                url={avatarUrl}
                size={avatarSize}
                className="mx_UserMenu_userAvatar_BaseAvatar"
            />
        </div>
    );
};

type ShareTypeOptionProps = HTMLAttributes<Element> & {
    label: string;
    shareType: LocationShareType;
    onClick?: ((e: ButtonEvent) => void | Promise<void>) | null;
};
const ShareTypeOption: React.FC<ShareTypeOptionProps> = ({ onClick, label, shareType, ...rest }) => (
    <AccessibleButton element="button" className="mx_ShareType_option" onClick={onClick ?? null} {...rest}>
        {shareType === LocationShareType.Own && <UserAvatar />}
        {shareType === LocationShareType.Pin && (
            <LocationIcon className={`mx_ShareType_option-icon ${LocationShareType.Pin}`} />
        )}
        {shareType === LocationShareType.Live && (
            <StyledLiveBeaconIcon className={`mx_ShareType_option-icon ${LocationShareType.Live}`} />
        )}

        {label}
    </AccessibleButton>
);

interface Props {
    setShareType: (shareType: LocationShareType) => void;
    enabledShareTypes: LocationShareType[];
}
const ShareType: React.FC<Props> = ({ setShareType, enabledShareTypes }) => {
    const labels = {
        [LocationShareType.Own]: _t("location_sharing|share_type_own"),
        [LocationShareType.Live]: _t("location_sharing|share_type_live"),
        [LocationShareType.Pin]: _t("location_sharing|share_type_pin"),
    };
    return (
        <div className="mx_ShareType">
            <LocationIcon className="mx_ShareType_badge" />
            <Heading className="mx_ShareType_heading" size="3">
                {_t("location_sharing|share_type_prompt")}
            </Heading>
            <div className="mx_ShareType_wrapper_options">
                {enabledShareTypes.map((type) => (
                    <ShareTypeOption
                        key={type}
                        onClick={() => setShareType(type)}
                        label={labels[type]}
                        shareType={type}
                        data-testid={`share-location-option-${type}`}
                    />
                ))}
            </div>
        </div>
    );
};

export default ShareType;
