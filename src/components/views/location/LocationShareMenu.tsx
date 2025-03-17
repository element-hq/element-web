/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type SyntheticEvent, useContext, useState } from "react";
import { type Room, type IEventRelation } from "matrix-js-sdk/src/matrix";

import MatrixClientContext from "../../../contexts/MatrixClientContext";
import ContextMenu, { type MenuProps } from "../../structures/ContextMenu";
import LocationPicker, { type ILocationPickerProps } from "./LocationPicker";
import { shareLiveLocation, shareLocation, LocationShareType } from "./shareLocation";
import SettingsStore from "../../../settings/SettingsStore";
import ShareDialogButtons from "./ShareDialogButtons";
import ShareType from "./ShareType";
import { OwnProfileStore } from "../../../stores/OwnProfileStore";
import { EnableLiveShare } from "./EnableLiveShare";
import { useFeatureEnabled } from "../../../hooks/useSettings";
import { SettingLevel } from "../../../settings/SettingLevel";

type Props = Omit<ILocationPickerProps, "onChoose" | "shareType"> & {
    onFinished: (ev?: SyntheticEvent) => void;
    menuPosition: MenuProps;
    openMenu: () => void;
    roomId: Room["roomId"];
    relation?: IEventRelation;
};

const getEnabledShareTypes = (relation?: IEventRelation): LocationShareType[] => {
    const enabledShareTypes = [LocationShareType.Own];

    // live locations cannot have a relation
    // hide the option when composer has a relation
    if (!relation) {
        enabledShareTypes.push(LocationShareType.Live);
    }

    enabledShareTypes.push(LocationShareType.Pin);

    return enabledShareTypes;
};

const LocationShareMenu: React.FC<Props> = ({ menuPosition, onFinished, sender, roomId, openMenu, relation }) => {
    const matrixClient = useContext(MatrixClientContext);
    const enabledShareTypes = getEnabledShareTypes(relation);
    const isLiveShareEnabled = useFeatureEnabled("feature_location_share_live");

    const multipleShareTypesEnabled = enabledShareTypes.length > 1;

    const [shareType, setShareType] = useState<LocationShareType | undefined>(
        multipleShareTypesEnabled ? undefined : LocationShareType.Own,
    );

    const displayName = OwnProfileStore.instance.displayName;
    const userId = matrixClient.getSafeUserId();

    const onLocationSubmit =
        shareType === LocationShareType.Live
            ? shareLiveLocation(matrixClient, roomId, displayName || userId, openMenu)
            : shareLocation(matrixClient, roomId, shareType ?? LocationShareType.Own, relation, openMenu);

    const onLiveShareEnableSubmit = (): void => {
        SettingsStore.setValue("feature_location_share_live", null, SettingLevel.DEVICE, true);
    };

    const shouldAdvertiseLiveLabsFlag = shareType === LocationShareType.Live && !isLiveShareEnabled;

    return (
        <ContextMenu {...menuPosition} onFinished={onFinished} managed={false}>
            <div className="mx_LocationShareMenu">
                {shouldAdvertiseLiveLabsFlag && <EnableLiveShare onSubmit={onLiveShareEnableSubmit} />}
                {!shouldAdvertiseLiveLabsFlag && !!shareType && (
                    <LocationPicker
                        sender={sender}
                        shareType={shareType}
                        onChoose={onLocationSubmit}
                        onFinished={onFinished}
                    />
                )}
                {!shareType && <ShareType setShareType={setShareType} enabledShareTypes={enabledShareTypes} />}
                <ShareDialogButtons
                    displayBack={!!shareType && multipleShareTypesEnabled}
                    onBack={() => setShareType(undefined)}
                    onCancel={onFinished}
                />
            </div>
        </ContextMenu>
    );
};

export default LocationShareMenu;
