/*
Copyright 2026 Element Creations Ltd.
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.
Copyright 2019 Michael Telatynski <7t3chguy@gmail.com>

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX, type ChangeEvent } from "react";
import { type MatrixEvent } from "matrix-js-sdk/src/matrix";
import { logger } from "matrix-js-sdk/src/logger";

import { _t } from "../../../languageHandler";
import { MatrixClientPeg } from "../../../MatrixClientPeg";
import SdkConfig from "../../../SdkConfig";
import Markdown from "../../../Markdown";
import BaseDialog from "./BaseDialog";
import DialogButtons from "../elements/DialogButtons";
import Field from "../elements/Field";
import Spinner from "../elements/Spinner";
import LabelledCheckbox from "../elements/LabelledCheckbox";

interface IProps {
    mxEvent: MatrixEvent;
    onFinished(report?: boolean): void;
}

interface IState {
    // A free-form text describing the abuse.
    reason: string;
    busy: boolean;
    err?: string;
    ignoreUserToo: boolean; // if true, user will be ignored/blocked on submit
}

/*
 * A dialog for reporting an event.
 */
export default class ReportEventDialog extends React.Component<IProps, IState> {
    public constructor(props: IProps) {
        super(props);

        this.state = {
            // A free-form text describing the abuse.
            reason: "",
            busy: false,
            err: undefined,
            ignoreUserToo: false, // default false, for now. Could easily be argued as default true
        };
    }

    private onIgnoreUserTooChanged = (newVal: boolean): void => {
        this.setState({ ignoreUserToo: newVal });
    };

    // The user has written down a freeform description of the abuse.
    private onReasonChange = ({ target: { value: reason } }: ChangeEvent<HTMLTextAreaElement>): void => {
        this.setState({ reason });
    };

    // The user has clicked "cancel".
    private onCancel = (): void => {
        this.props.onFinished(false);
    };

    // The user has clicked "submit".
    private onSubmit = async (): Promise<void> => {
        let reason = this.state.reason || "";
        reason = reason.trim();

        // Reasons are required on the API, even if unhelpful like "."
        if (!reason) {
            this.setState({
                err: _t("report_content|missing_reason"),
            });
            return;
        }

        this.setState({
            busy: true,
            err: undefined,
        });

        try {
            const client = MatrixClientPeg.safeGet();
            const ev = this.props.mxEvent;

            // Report to homeserver admin through the dedicated Matrix API. We hardcode the "score" because it's
            // not actually used by anything.
            await client.reportEvent(ev.getRoomId()!, ev.getId()!, -100, this.state.reason.trim());

            // if the user should also be ignored, do that
            if (this.state.ignoreUserToo) {
                await client.setIgnoredUsers([...client.getIgnoredUsers(), ev.getSender()!]);
            }

            this.props.onFinished(true);
        } catch (e) {
            logger.error(e);
            this.setState({
                busy: false,
                err: e instanceof Error ? e.message : String(e),
            });
        }
    };

    public render(): React.ReactNode {
        let error: JSX.Element | undefined;
        if (this.state.err) {
            error = <div className="error">{this.state.err}</div>;
        }

        let progress: JSX.Element | undefined;
        if (this.state.busy) {
            progress = (
                <div className="progress">
                    <Spinner />
                </div>
            );
        }

        const ignoreUserCheckbox = (
            <LabelledCheckbox
                value={this.state.ignoreUserToo}
                label={_t("report_content|ignore_user")}
                byline={_t("report_content|hide_messages_from_user")}
                onChange={this.onIgnoreUserTooChanged}
                disabled={this.state.busy}
            />
        );

        const adminMessageMD = SdkConfig.getObject("report_event")?.get("admin_message_md", "adminMessageMD");
        let adminMessage: JSX.Element | undefined;
        if (adminMessageMD) {
            const html = new Markdown(adminMessageMD).toHTML({ externalLinks: true });
            adminMessage = <p dangerouslySetInnerHTML={{ __html: html }} />;
        }

        return (
            <BaseDialog
                className="mx_ReportEventDialog"
                onFinished={this.props.onFinished}
                title={_t("report_content|report_content_to_homeserver")}
                contentId="mx_ReportEventDialog"
            >
                <div className="mx_ReportEventDialog" id="mx_ReportEventDialog">
                    <p>{_t("report_content|description")}</p>
                    {adminMessage}
                    <Field
                        className="mx_ReportEventDialog_reason"
                        element="textarea"
                        label={_t("room_settings|permissions|ban_reason")}
                        rows={5}
                        onChange={this.onReasonChange}
                        value={this.state.reason}
                        disabled={this.state.busy}
                    />
                    {progress}
                    {error}
                    {ignoreUserCheckbox}
                </div>
                <DialogButtons
                    primaryButton={_t("action|send_report")}
                    onPrimaryButtonClick={this.onSubmit}
                    focus={true}
                    onCancel={this.onCancel}
                    disabled={this.state.busy}
                />
            </BaseDialog>
        );
    }
}
