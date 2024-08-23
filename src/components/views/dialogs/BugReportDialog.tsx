/*
Copyright 2017 OpenMarket Ltd
Copyright 2018 New Vector Ltd
Copyright 2019 Michael Telatynski <7t3chguy@gmail.com>
Copyright 2019 The Matrix.org Foundation C.I.C.

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

import SdkConfig from "../../../SdkConfig";
import Modal from "../../../Modal";
import { _t } from "../../../languageHandler";
import sendBugReport, { downloadBugReport } from "../../../rageshake/submit-rageshake";
import AccessibleButton from "../elements/AccessibleButton";
import QuestionDialog from "./QuestionDialog";
import BaseDialog from "./BaseDialog";
import Field from "../elements/Field";
import Spinner from "../elements/Spinner";
import DialogButtons from "../elements/DialogButtons";
import { sendSentryReport } from "../../../sentry";
import defaultDispatcher from "../../../dispatcher/dispatcher";
import { Action } from "../../../dispatcher/actions";

interface IProps {
    onFinished: (success: boolean) => void;
    initialText?: string;
    label?: string;
    error?: unknown;
}

interface IState {
    sendLogs: boolean;
    busy: boolean;
    err: string | null;
    issueUrl: string;
    text: string;
    progress: string | null;
    downloadBusy: boolean;
    downloadProgress: string | null;
}

export default class BugReportDialog extends React.Component<IProps, IState> {
    private unmounted: boolean;
    private issueRef: React.RefObject<Field>;

    public constructor(props: IProps) {
        super(props);

        this.state = {
            sendLogs: true,
            busy: false,
            err: null,
            issueUrl: "",
            text: props.initialText || "",
            progress: null,
            downloadBusy: false,
            downloadProgress: null,
        };

        this.unmounted = false;
        this.issueRef = React.createRef();

        // Get all of the extra info dumped to the console when someone is about
        // to send debug logs. Since this is a fire and forget action, we do
        // this when the bug report dialog is opened instead of when we submit
        // logs because we have no signal to know when all of the various
        // components have finished logging. Someone could potentially send logs
        // before we fully dump everything but it's probably unlikely.
        defaultDispatcher.dispatch({
            action: Action.DumpDebugLogs,
        });
    }

    public componentDidMount(): void {
        this.issueRef.current?.focus();
    }

    public componentWillUnmount(): void {
        this.unmounted = true;
    }

    private onCancel = (): void => {
        this.props.onFinished(false);
    };

    private onSubmit = (): void => {
        if ((!this.state.text || !this.state.text.trim()) && (!this.state.issueUrl || !this.state.issueUrl.trim())) {
            this.setState({
                err: _t("bug_reporting|error_empty"),
            });
            return;
        }

        const userText =
            (this.state.text.length > 0 ? this.state.text + "\n\n" : "") +
            "Issue: " +
            (this.state.issueUrl.length > 0 ? this.state.issueUrl : "No issue link given");

        this.setState({ busy: true, progress: null, err: null });
        this.sendProgressCallback(_t("bug_reporting|preparing_logs"));

        sendBugReport(SdkConfig.get().bug_report_endpoint_url, {
            userText,
            sendLogs: true,
            progressCallback: this.sendProgressCallback,
            labels: this.props.label ? [this.props.label] : [],
        }).then(
            () => {
                if (!this.unmounted) {
                    this.props.onFinished(false);
                    Modal.createDialog(QuestionDialog, {
                        title: _t("bug_reporting|logs_sent"),
                        description: _t("bug_reporting|thank_you"),
                        hasCancelButton: false,
                    });
                }
            },
            (err) => {
                if (!this.unmounted) {
                    this.setState({
                        busy: false,
                        progress: null,
                        err: _t("bug_reporting|failed_send_logs") + `${err.message}`,
                    });
                }
            },
        );

        sendSentryReport(this.state.text, this.state.issueUrl, this.props.error);
    };

    private onDownload = async (): Promise<void> => {
        this.setState({ downloadBusy: true });
        this.downloadProgressCallback(_t("bug_reporting|preparing_download"));

        try {
            await downloadBugReport({
                sendLogs: true,
                progressCallback: this.downloadProgressCallback,
                labels: this.props.label ? [this.props.label] : [],
            });

            this.setState({
                downloadBusy: false,
                downloadProgress: null,
            });
        } catch (err) {
            if (!this.unmounted) {
                this.setState({
                    downloadBusy: false,
                    downloadProgress:
                        _t("bug_reporting|failed_send_logs") + `${err instanceof Error ? err.message : ""}`,
                });
            }
        }
    };

    private onTextChange = (ev: React.FormEvent<HTMLTextAreaElement>): void => {
        this.setState({ text: ev.currentTarget.value });
    };

    private onIssueUrlChange = (ev: React.FormEvent<HTMLInputElement>): void => {
        this.setState({ issueUrl: ev.currentTarget.value });
    };

    private sendProgressCallback = (progress: string): void => {
        if (this.unmounted) {
            return;
        }
        this.setState({ progress });
    };

    private downloadProgressCallback = (downloadProgress: string): void => {
        if (this.unmounted) {
            return;
        }
        this.setState({ downloadProgress });
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
                    {this.state.progress} ...
                </div>
            );
        }

        let warning: JSX.Element | undefined;
        if (window.Modernizr && Object.values(window.Modernizr).some((support) => support === false)) {
            warning = (
                <p>
                    <b>{_t("bug_reporting|unsupported_browser")}</b>
                </p>
            );
        }

        return (
            <BaseDialog
                className="mx_BugReportDialog"
                onFinished={this.onCancel}
                title={_t("bug_reporting|submit_debug_logs")}
                contentId="mx_Dialog_content"
            >
                <div className="mx_Dialog_content" id="mx_Dialog_content">
                    {warning}
                    <p>{_t("bug_reporting|description")}</p>
                    <p>
                        <b>
                            {_t(
                                "bug_reporting|before_submitting",
                                {},
                                {
                                    a: (sub) => (
                                        <a
                                            target="_blank"
                                            href={SdkConfig.get().feedback.new_issue_url}
                                            rel="noreferrer noopener"
                                        >
                                            {sub}
                                        </a>
                                    ),
                                },
                            )}
                        </b>
                    </p>

                    <div className="mx_BugReportDialog_download">
                        <AccessibleButton onClick={this.onDownload} kind="link" disabled={this.state.downloadBusy}>
                            {_t("bug_reporting|download_logs")}
                        </AccessibleButton>
                        {this.state.downloadProgress && <span>{this.state.downloadProgress} ...</span>}
                    </div>

                    <Field
                        type="text"
                        className="mx_BugReportDialog_field_input"
                        label={_t("bug_reporting|github_issue")}
                        onChange={this.onIssueUrlChange}
                        value={this.state.issueUrl}
                        placeholder="https://github.com/vector-im/element-web/issues/..."
                        ref={this.issueRef}
                    />
                    <Field
                        className="mx_BugReportDialog_field_input"
                        element="textarea"
                        label={_t("bug_reporting|textarea_label")}
                        rows={5}
                        onChange={this.onTextChange}
                        value={this.state.text}
                        placeholder={_t("bug_reporting|additional_context")}
                    />
                    {progress}
                    {error}
                </div>
                <DialogButtons
                    primaryButton={_t("bug_reporting|send_logs")}
                    onPrimaryButtonClick={this.onSubmit}
                    focus={true}
                    onCancel={this.onCancel}
                    disabled={this.state.busy}
                />
            </BaseDialog>
        );
    }
}
