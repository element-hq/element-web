/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { ChangeEventHandler, useCallback, useState } from "react";
import { Room } from "matrix-js-sdk/src/matrix";

import { _t } from "../../../languageHandler";
import BaseDialog from "./BaseDialog";
import DialogButtons from "../elements/DialogButtons";
import { Checkbox, Field, HelpMessage, InlineField, Label, Root } from "@vector-im/compound-web";

interface IProps {
    room: Room;
    onFinished: (shouldReject: boolean, ignoreUser: boolean, reportRoom: false|string) => void;
}

export const ConfirmRejectInviteDialog: React.FunctionComponent<IProps> = ({onFinished, room}) => {

    const [shouldReport, setShouldReport] = useState<boolean>(false);
    const shouldReportChanged = useCallback<ChangeEventHandler<HTMLInputElement>>((e) => setShouldReport(e.target.checked), [setShouldReport]);

    const [ignoreUser, setIgnoreUser] = useState<boolean>(false);
    const shouldIgnoreUserChanged = useCallback<ChangeEventHandler<HTMLInputElement>>((e) => setIgnoreUser(e.target.checked), [setIgnoreUser]);

    const [reportReason, setReportReason] = useState<string>("");
    const reportReasonChanged = useCallback<ChangeEventHandler<HTMLTextAreaElement>>((e) => setReportReason(e.target.value), [setReportReason]);

    const onCancel = useCallback(() => onFinished(false, false, false), [onFinished]);
    const onOk = useCallback(() => onFinished(true, ignoreUser, shouldReport ? reportReason : false), [onFinished, ignoreUser, shouldReport, reportReason]);


    return (
        <BaseDialog
            className={"mx_ConfirmRejectInviteDialog"}
            onFinished={onCancel}
            title={_t("reject_invitation_dialog|title")}
            contentId="mx_Dialog_content"
        >
            <Root id="mx_ConfirmRejectInviteDialogForm">
                <p>{_t("reject_invitation_dialog|confirmation", {  }, {
                    strong: () => (
                        <strong>
                            {room.name}
                        </strong>
                    ),
                },)}</p>
                <InlineField name="ignore-user" control={<Checkbox checked={ignoreUser} onChange={shouldIgnoreUserChanged} />}>
                    <Label>Ignore user</Label>
                    <HelpMessage>You will not see any messages or room invites from this user.</HelpMessage>
                </InlineField>
                <InlineField name="report-room" control={<Checkbox checked={shouldReport} onChange={shouldReportChanged} />}>
                    <Label>Report room</Label>
                    <HelpMessage>{_t("report_room|description")}</HelpMessage>
                </InlineField>
                {shouldReport && <Field name="reason">
                    <Label htmlFor="mx_ConfirmRejectInviteDialog_reason">{_t("room_settings|permissions|ban_reason")}</Label>
                    <textarea
                        id="mx_ConfirmRejectInviteDialog_reason"
                        placeholder={_t("report_room|reason_placeholder")}
                        rows={2}
                        onChange={reportReasonChanged}
                        value={shouldReport ? reportReason : ""}
                        disabled={!shouldReport}
                    />
                </Field>}
                <DialogButtons
                    primaryButton="Reject invite"
                    primaryButtonClass="danger"
                    cancelButton="Cancel"
                    onPrimaryButtonClick={onOk}
                    onCancel={onCancel}
                />
            </Root>
        </BaseDialog>
    );
}