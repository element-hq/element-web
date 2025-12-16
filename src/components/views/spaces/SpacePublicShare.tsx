/*
Copyright 2024 New Vector Ltd.
Copyright 2021-2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { useState } from "react";
import { type Room } from "matrix-js-sdk/src/matrix";
import { sleep } from "matrix-js-sdk/src/utils";
import { LinkIcon } from "@vector-im/compound-design-tokens/assets/web/icons";

import { _t } from "../../../languageHandler";
import { copyPlaintext } from "../../../utils/strings";
import { RoomPermalinkCreator } from "../../../utils/permalinks/Permalinks";
import { showRoomInviteDialog } from "../../../RoomInvite";
import { MatrixClientPeg } from "../../../MatrixClientPeg";
import { shouldShowComponent } from "../../../customisations/helpers/UIComponents";
import { UIComponent } from "../../../settings/UIFeature";
import { Icon as InviteIcon } from "../../../../res/img/element-icons/room/invite.svg";
import SpacePillButton from "../../structures/SpacePillButton.tsx";

interface IProps {
    space: Room;
    onFinished?(): void;
}

const SpacePublicShare: React.FC<IProps> = ({ space, onFinished }) => {
    const [copiedText, setCopiedText] = useState(_t("action|click_to_copy"));

    return (
        <div className="mx_SpacePublicShare">
            <SpacePillButton
                icon={<LinkIcon />}
                title={_t("space|invite_link")}
                description={copiedText}
                onClick={async (): Promise<void> => {
                    const permalinkCreator = new RoomPermalinkCreator(space);
                    permalinkCreator.load();
                    const success = await copyPlaintext(permalinkCreator.forShareableRoom());
                    const text = success ? _t("common|copied") : _t("error|failed_copy");
                    setCopiedText(text);
                    await sleep(5000);
                    if (copiedText === text) {
                        // if the text hasn't changed by another click then clear it after some time
                        setCopiedText(_t("action|click_to_copy"));
                    }
                }}
            />
            {space.canInvite(MatrixClientPeg.safeGet().getSafeUserId()) &&
            shouldShowComponent(UIComponent.InviteUsers) ? (
                <SpacePillButton
                    icon={<InviteIcon />}
                    title={_t("space|invite")}
                    description={_t("space|invite_description")}
                    onClick={() => {
                        if (onFinished) onFinished();
                        showRoomInviteDialog(space.roomId);
                    }}
                />
            ) : null}
        </div>
    );
};

export default SpacePublicShare;
