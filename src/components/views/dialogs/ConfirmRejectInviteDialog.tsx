/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type ChangeEventHandler, useCallback, useState } from "react";
import { Checkbox, Field, HelpMessage, InlineField, Label, Root, TextInput } from "@vector-im/compound-web";

import { _t } from "../../../languageHandler";
import BaseDialog from "./BaseDialog";
import DialogButtons from "../elements/DialogButtons";

interface IProps {
    onFinished: (shouldReject: boolean, ignoreUser: boolean, reportRoom: false | string) => void;
    promptOptions: boolean;
}

export const ConfirmRejectInviteDialog: React.FunctionComponent<IProps> = ({ onFinished, promptOptions }) => {
    const [shouldReport, setShouldReport] = useState<boolean>(false);
    const shouldReportChanged = useCallback<ChangeEventHandler<HTMLInputElement>>(
        (e) => setShouldReport(e.target.checked),
        [setShouldReport],
    );

    const [ignoreUser, setIgnoreUser] = useState<boolean>(false);
    const shouldIgnoreUserChanged = useCallback<ChangeEventHandler<HTMLInputElement>>(
        (e) => setIgnoreUser(e.target.checked),
        [setIgnoreUser],
    );

    const [reportReason, setReportReason] = useState<string>("");
    const reportReasonChanged = useCallback<ChangeEventHandler<HTMLInputElement>>(
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
            className="mx_ConfirmRejectInviteDialog"
            onFinished={onCancel}
            title={_t("reject_invitation_dialog|title")}
            contentId="mx_Dialog_content"
        >
            <Root>
                <p>{_t("reject_invitation_dialog|confirmation")}</p>
                {promptOptions && (
                    <InlineField
                        name="ignore-user"
                        control={
                            <Checkbox
                                id="mx_ConfirmRejectInviteDialog_ignore_user"
                                checked={ignoreUser}
                                onChange={shouldIgnoreUserChanged}
                            />
                        }
                    >
                        <Label htmlFor="mx_ConfirmRejectInviteDialog_ignore_user">{_t("report_content|ignore_user")}</Label>
                        <HelpMessage>{_t("reject_invitation_dialog|ignore_user_help")}</HelpMessage>
                    </InlineField>
                )}
                {promptOptions && (
                    <InlineField
                        name="report-room"
                        control={
                            <Checkbox
                                id="mx_ConfirmRejectInviteDialog_report_room"
                                checked={shouldReport}
                                onChange={shouldReportChanged}
                            />
                        }
                    >
                        <Label htmlFor="mx_ConfirmRejectInviteDialog_report_room">{_t("action|report_room")}</Label>
                        <HelpMessage>{_t("report_room|description")}</HelpMessage>
                        <Field name="report-reason">
                            <Label htmlFor="mx_ConfirmRejectInviteDialog_reason">
                                {_t("room_settings|permissions|ban_reason")}
                            </Label>
                            <HelpMessage>{_t("reject_invitation_dialog|reason_description")}</HelpMessage>
                            <TextInput
                                id="mx_ConfirmRejectInviteDialog_reason"
                                disabled={!shouldReport}
                                value={shouldReport ? reportReason : ""}
                                placeholder={_t("report_room|reason_placeholder")}
                                onChange={reportReasonChanged}
                            />
                        </Field>
                    </InlineField>
                )}
                <DialogButtons
                    primaryButton={_t("action|reject_invite")}
                    primaryButtonClass="danger"
                    cancelButton={_t("action|cancel")}
                    onPrimaryButtonClick={onOk}
                    onCancel={onCancel}
                />
            </Root>
        </BaseDialog>
    );
};
