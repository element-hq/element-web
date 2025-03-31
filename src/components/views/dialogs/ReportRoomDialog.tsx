/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX, type ChangeEventHandler, useCallback, useState } from "react";
import { Root, Field, Label, InlineSpinner, ErrorMessage } from "@vector-im/compound-web";

import { _t } from "../../../languageHandler";
import SdkConfig from "../../../SdkConfig";
import Markdown from "../../../Markdown";
import BaseDialog from "./BaseDialog";
import DialogButtons from "../elements/DialogButtons";
import { MatrixClientPeg } from "../../../MatrixClientPeg";

interface IProps {
    roomId: string;
    onFinished(complete: boolean): void;
}

/*
 * A dialog for reporting a room.
 */

export const ReportRoomDialog: React.FC<IProps> = function ({ roomId, onFinished }) {
    const [error, setErr] = useState<string>();
    const [busy, setBusy] = useState(false);
    const [sent, setSent] = useState(false);
    const [reason, setReason] = useState("");
    const client = MatrixClientPeg.safeGet();

    const onReasonChange = useCallback<ChangeEventHandler<HTMLTextAreaElement>>((e) => setReason(e.target.value), []);
    const onCancel = useCallback(() => onFinished(sent), [sent, onFinished]);
    const onSubmit = useCallback(async () => {
        setBusy(true);
        try {
            await client.reportRoom(roomId, reason);
            setSent(true);
        } catch (ex) {
            if (ex instanceof Error) {
                setErr(ex.message);
            } else {
                setErr("Unknown error");
            }
        } finally {
            setBusy(false);
        }
    }, [roomId, reason, client]);

    const adminMessageMD = SdkConfig.getObject("report_event")?.get("admin_message_md", "adminMessageMD");
    let adminMessage: JSX.Element | undefined;
    if (adminMessageMD) {
        const html = new Markdown(adminMessageMD).toHTML({ externalLinks: true });
        adminMessage = <p dangerouslySetInnerHTML={{ __html: html }} />;
    }

    return (
        <BaseDialog
            className="mx_ReportRoomDialog"
            onFinished={() => onFinished(sent)}
            title={_t("report_room|title")}
            contentId="mx_ReportEventDialog"
        >
            {sent && <p>{_t("report_room|sent")}</p>}
            {!sent && (
                <Root id="mx_ReportEventDialog" onSubmit={onSubmit}>
                    <p>{_t("report_room|description")}</p>
                    {adminMessage}
                    <Field name="reason">
                        <Label htmlFor="mx_ReportRoomDialog_reason">{_t("room_settings|permissions|ban_reason")}</Label>
                        <textarea
                            id="mx_ReportRoomDialog_reason"
                            placeholder={_t("report_room|reason_placeholder")}
                            rows={5}
                            onChange={onReasonChange}
                            value={reason}
                            disabled={busy}
                        />
                        {error ? <ErrorMessage>{error}</ErrorMessage> : null}
                    </Field>
                    {busy ? <InlineSpinner /> : null}
                    <DialogButtons
                        primaryButton={_t("action|send_report")}
                        onPrimaryButtonClick={onSubmit}
                        focus={true}
                        onCancel={onCancel}
                        disabled={busy}
                    />
                </Root>
            )}
        </BaseDialog>
    );
};
