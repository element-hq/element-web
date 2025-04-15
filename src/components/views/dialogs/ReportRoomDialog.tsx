/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX, type ChangeEventHandler, useCallback, useState } from "react";
import { Root, Field, Label, InlineSpinner, ErrorMessage, HelpMessage } from "@vector-im/compound-web";

import { _t } from "../../../languageHandler";
import SdkConfig from "../../../SdkConfig";
import Markdown from "../../../Markdown";
import BaseDialog from "./BaseDialog";
import DialogButtons from "../elements/DialogButtons";
import { MatrixClientPeg } from "../../../MatrixClientPeg";
import LabelledToggleSwitch from "../elements/LabelledToggleSwitch";

interface IProps {
    roomId: string;
    onFinished(leave: boolean): void;
}

/*
 * A dialog for reporting a room.
 */

export const ReportRoomDialog: React.FC<IProps> = function ({ roomId, onFinished }) {
    const [error, setErr] = useState<string>();
    const [busy, setBusy] = useState(false);
    const [reason, setReason] = useState("");
    const [leaveRoom, setLeaveRoom] = useState(false);
    const client = MatrixClientPeg.safeGet();

    const onReasonChange = useCallback<ChangeEventHandler<HTMLTextAreaElement>>((e) => setReason(e.target.value), []);
    const onCancel = useCallback(() => onFinished(false), [onFinished]);
    const onSubmit = useCallback(async () => {
        setBusy(true);
        try {
            await client.reportRoom(roomId, reason);
            onFinished(leaveRoom);
        } catch (ex) {
            setBusy(false);
            if (ex instanceof Error) {
                setErr(ex.message);
            } else {
                setErr("Unknown error");
            }
        }
    }, [roomId, reason, client, leaveRoom, onFinished]);

    const adminMessageMD = SdkConfig.getObject("report_event")?.get("admin_message_md", "adminMessageMD");
    let adminMessage: JSX.Element | undefined;
    if (adminMessageMD) {
        const html = new Markdown(adminMessageMD).toHTML({ externalLinks: true });
        adminMessage = <p dangerouslySetInnerHTML={{ __html: html }} />;
    }

    return (
        <BaseDialog
            className="mx_ReportRoomDialog"
            onFinished={onCancel}
            title={_t("action|report_room")}
            contentId="mx_ReportEventDialog"
        >
            <Root id="mx_ReportEventDialog" onSubmit={onSubmit}>
                <Field name="reason">
                    <Label htmlFor="mx_ReportRoomDialog_reason">{_t("report_room|reason_label")}</Label>
                    <textarea
                        id="mx_ReportRoomDialog_reason"
                        rows={5}
                        onChange={onReasonChange}
                        value={reason}
                        disabled={busy}
                    />
                    {error ? <ErrorMessage>{error}</ErrorMessage> : null}
                    <HelpMessage>{_t("report_room|description")}</HelpMessage>
                </Field>
                {adminMessage}
                {busy ? <InlineSpinner /> : null}
                <LabelledToggleSwitch
                    label={_t("room_list|more_options|leave_room")}
                    value={leaveRoom}
                    onChange={setLeaveRoom}
                />
                <DialogButtons
                    primaryButton={_t("action|send_report")}
                    onPrimaryButtonClick={onSubmit}
                    focus={true}
                    onCancel={onCancel}
                    primaryButtonClass="danger"
                    primaryDisabled={busy || !reason}
                />
            </Root>
        </BaseDialog>
    );
};
