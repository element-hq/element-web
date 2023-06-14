/*
Copyright 2021 The Matrix.org Foundation C.I.C.

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

import React, { useState } from "react";
import { Room } from "matrix-js-sdk/src/models/room";
import { sleep } from "matrix-js-sdk/src/utils";

import { _t } from "../../../languageHandler";
import AccessibleButton from "../elements/AccessibleButton";
import { copyPlaintext } from "../../../utils/strings";
import { RoomPermalinkCreator } from "../../../utils/permalinks/Permalinks";
import { showRoomInviteDialog } from "../../../RoomInvite";
import { MatrixClientPeg } from "../../../MatrixClientPeg";
import { shouldShowComponent } from "../../../customisations/helpers/UIComponents";
import { UIComponent } from "../../../settings/UIFeature";

interface IProps {
    space: Room;
    onFinished?(): void;
}

const SpacePublicShare: React.FC<IProps> = ({ space, onFinished }) => {
    const [copiedText, setCopiedText] = useState(_t("Click to copy"));

    return (
        <div className="mx_SpacePublicShare">
            <AccessibleButton
                className="mx_SpacePublicShare_shareButton"
                onClick={async (): Promise<void> => {
                    const permalinkCreator = new RoomPermalinkCreator(space);
                    permalinkCreator.load();
                    const success = await copyPlaintext(permalinkCreator.forShareableRoom());
                    const text = success ? _t("Copied!") : _t("Failed to copy");
                    setCopiedText(text);
                    await sleep(5000);
                    if (copiedText === text) {
                        // if the text hasn't changed by another click then clear it after some time
                        setCopiedText(_t("Click to copy"));
                    }
                }}
            >
                {_t("Share invite link")}
                <div>{copiedText}</div>
            </AccessibleButton>
            {space.canInvite(MatrixClientPeg.get()?.getSafeUserId()) && shouldShowComponent(UIComponent.InviteUsers) ? (
                <AccessibleButton
                    className="mx_SpacePublicShare_inviteButton"
                    onClick={() => {
                        if (onFinished) onFinished();
                        showRoomInviteDialog(space.roomId);
                    }}
                >
                    {_t("Invite people")}
                    <div>{_t("Invite with email or username")}</div>
                </AccessibleButton>
            ) : null}
        </div>
    );
};

export default SpacePublicShare;
