/*
Copyright 2022 The Matrix.org Foundation C.I.C.

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

import React, { HTMLAttributes, useContext } from "react";

import MatrixClientContext from "../../../contexts/MatrixClientContext";
import { _t } from "../../../languageHandler";
import { OwnProfileStore } from "../../../stores/OwnProfileStore";
import BaseAvatar from "../avatars/BaseAvatar";
import AccessibleButton, { ButtonEvent } from "../elements/AccessibleButton";
import Heading from "../typography/Heading";
import { Icon as LocationIcon } from "../../../../res/img/element-icons/location.svg";
import { LocationShareType } from "./shareLocation";
import StyledLiveBeaconIcon from "../beacon/StyledLiveBeaconIcon";

const UserAvatar: React.FC = () => {
    const matrixClient = useContext(MatrixClientContext);
    const userId = matrixClient.getSafeUserId();
    const displayName = OwnProfileStore.instance.displayName ?? undefined;
    // 40 - 2px border
    const avatarSize = 36;
    const avatarUrl = OwnProfileStore.instance.getHttpAvatarUrl(avatarSize) ?? undefined;

    return (
        <div className={`mx_ShareType_option-icon ${LocationShareType.Own}`}>
            <BaseAvatar
                idName={userId}
                name={displayName}
                url={avatarUrl}
                width={avatarSize}
                height={avatarSize}
                resizeMethod="crop"
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
        [LocationShareType.Own]: _t("My current location"),
        [LocationShareType.Live]: _t("My live location"),
        [LocationShareType.Pin]: _t("Drop a Pin"),
    };
    return (
        <div className="mx_ShareType">
            <LocationIcon className="mx_ShareType_badge" />
            <Heading className="mx_ShareType_heading" size="h3">
                {_t("What location type do you want to share?")}
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
