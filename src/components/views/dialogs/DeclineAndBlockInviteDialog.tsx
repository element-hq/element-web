/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type ChangeEventHandler, useCallback, useState } from "react";
import { Field, Label, Root } from "@vector-im/compound-web";

import { _t } from "../../../languageHandler";
import BaseDialog from "./BaseDialog";
import DialogButtons from "../elements/DialogButtons";
import LabelledToggleSwitch from "../elements/LabelledToggleSwitch";

interface IProps {
    onFinished: (shouldReject: boolean, ignoreUser: boolean, reportRoom: false | string) => void;
    roomName: string;
}

export const DeclineAndBlockInviteDialog: React.FunctionComponent<IProps> = ({ onFinished, roomName }) => {
    const [shouldReport, setShouldReport] = useState<boolean>(false);
    const [ignoreUser, setIgnoreUser] = useState<boolean>(false);

    const [reportReason, setReportReason] = useState<string>("");
    const reportReasonChanged = useCallback<ChangeEventHandler<HTMLTextAreaElement>>(
        (e) => setReportReason(e.target.value),
        [setReportReason],
    );

    const onCancel = useCallback(() => onFinished(false, false, false), [onFinished]);
    const onOk = useCallback(
        () => onFinished(true, ignoreUser, shouldReport ? reportReason : false),
        [onFinished, ignoreUser, shouldReport, reportReason],
    );

    return (
        <BaseDialog
            className="mx_DeclineAndBlockInviteDialog"
            onFinished={onCancel}
            title={_t("decline_invitation_dialog|title")}
            contentId="mx_Dialog_content"
        >
            <Root>
                <p>{_t("decline_invitation_dialog|confirm", { roomName })}</p>
                <LabelledToggleSwitch
                    label={_t("report_content|ignore_user")}
                    onChange={setIgnoreUser}
                    caption={_t("decline_invitation_dialog|ignore_user_help")}
                    value={ignoreUser}
                />
                <LabelledToggleSwitch
                    label={_t("action|report_room")}
                    onChange={setShouldReport}
                    caption={_t("decline_invitation_dialog|report_room_description")}
                    value={shouldReport}
                />
                <Field name="report-reason" aria-disabled={!shouldReport}>
                    <Label htmlFor="mx_DeclineAndBlockInviteDialog_reason">
                        {_t("room_settings|permissions|ban_reason")}
                    </Label>
                    <textarea
                        id="mx_DeclineAndBlockInviteDialog_reason"
                        className="mx_RoomReportTextArea"
                        placeholder={_t("decline_invitation_dialog|reason_description")}
                        rows={5}
                        onChange={reportReasonChanged}
                        value={shouldReport ? reportReason : ""}
                        disabled={!shouldReport}
                    />
                </Field>
                <DialogButtons
                    primaryButton={_t("action|decline_invite")}
                    primaryButtonClass="danger"
                    cancelButton={_t("action|cancel")}
                    onPrimaryButtonClick={onOk}
                    onCancel={onCancel}
                />
            </Root>
        </BaseDialog>
    );
};
