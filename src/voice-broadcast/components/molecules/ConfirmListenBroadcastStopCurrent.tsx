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
        <BaseDialog title={_t("Listen to live broadcast?")} hasCancel={true} onFinished={onFinished}>
            <p>
                {_t(
                    "If you start listening to this live broadcast, " +
                        "your current live broadcast recording will be ended.",
                )}
            </p>
            <DialogButtons
                onPrimaryButtonClick={() => onFinished(true)}
                primaryButton={_t("Yes, end my recording")}
                cancelButton={_t("No")}
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
