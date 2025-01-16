/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";

import Modal from "../../../Modal";
import DevtoolsDialog from "../dialogs/DevtoolsDialog";
import { IconizedContextMenuOption } from "./IconizedContextMenu";
import { _t } from "../../../languageHandler";

interface Props {
    onFinished: () => void;
    roomId: string;
}

export const DeveloperToolsOption: React.FC<Props> = ({ onFinished, roomId }) => {
    return (
        <IconizedContextMenuOption
            onClick={() => {
                Modal.createDialog(
                    DevtoolsDialog,
                    {
                        onFinished: () => {},
                        roomId: roomId,
                    },
                    "mx_DevtoolsDialog_wrapper",
                );
                onFinished();
            }}
            label={_t("devtools|title")}
            iconClassName="mx_IconizedContextMenu_developerTools"
        />
    );
};
