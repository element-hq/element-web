/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import React from "react";

import BaseDialog from "../../../components/views/dialogs/BaseDialog";
import DialogButtons from "../../../components/views/elements/DialogButtons";
import { _t } from "../../../languageHandler";
import Modal from "../../../Modal";

interface Props {
    onFinished: (confirmed?: boolean) => void;
}

export const ConfirmListenBroadcastStopCurrentDialog: React.FC<Props> = ({ onFinished }) => {
    return (
        <BaseDialog title={_t("voice_broadcast|confirm_listen_title")} hasCancel={true} onFinished={onFinished}>
            <p>{_t("voice_broadcast|confirm_listen_description")}</p>
            <DialogButtons
                onPrimaryButtonClick={() => onFinished(true)}
                primaryButton={_t("voice_broadcast|confirm_listen_affirm")}
                cancelButton={_t("action|no")}
                onCancel={() => onFinished(false)}
            />
        </BaseDialog>
    );
};

export const showConfirmListenBroadcastStopCurrentDialog = async (): Promise<boolean> => {
    const { finished } = Modal.createDialog(ConfirmListenBroadcastStopCurrentDialog);
    const [confirmed] = await finished;
    return !!confirmed;
};
