/*
Copyright 2017 OpenMarket Ltd

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

import React from 'react';
import sdk from 'matrix-react-sdk';
import SdkConfig from 'matrix-react-sdk/lib/SdkConfig';
import Modal from 'matrix-react-sdk/lib/Modal';
import { _t } from 'matrix-react-sdk/lib/languageHandler';

export default class BugReportDialog extends React.Component {
    constructor(props, context) {
        super(props, context);
        this.state = {
            sendLogs: true,
            busy: false,
            err: null,
            issueUrl: "",
            text: "",
            progress: null,
        };
        this._unmounted = false;
        this._onSubmit = this._onSubmit.bind(this);
        this._onCancel = this._onCancel.bind(this);
        this._onTextChange = this._onTextChange.bind(this);
        this._onIssueUrlChange = this._onIssueUrlChange.bind(this);
        this._onSendLogsChange = this._onSendLogsChange.bind(this);
        this._sendProgressCallback = this._sendProgressCallback.bind(this);
    }

    componentWillUnmount() {
        this._unmounted = true;
    }

    _onCancel(ev) {
        this.props.onFinished(false);
    }

    _onSubmit(ev) {
        const userText =
            (this.state.text.length > 0 ? this.state.text + '\n\n': '') + 'Issue: ' +
            (this.state.issueUrl.length > 0 ? this.state.issueUrl : 'No issue link given');

        this.setState({ busy: true, progress: null, err: null });
        this._sendProgressCallback(_t("Preparing to send logs"));

        require(['../../../vector/submit-rageshake'], (s) => {
            s(SdkConfig.get().bug_report_endpoint_url, {
                userText,
                sendLogs: true,
                progressCallback: this._sendProgressCallback,
            }).then(() => {
                if (!this._unmounted) {
                    this.props.onFinished(false);
                    const QuestionDialog = sdk.getComponent("dialogs.QuestionDialog");
                    Modal.createTrackedDialog('Bug report sent', '', QuestionDialog, {
                        title: _t('Logs sent'),
                        description: _t('Thank you!'),
                        hasCancelButton: false,
                    });
                }
            }, (err) => {
                if (!this._unmounted) {
                    this.setState({
                        busy: false,
                        progress: null,
                        err: _t("Failed to send logs: ") + `${err.message}`,
                    });
                }
            });
        });
    }

    _onTextChange(ev) {
        this.setState({ text: ev.target.value });
    }

    _onIssueUrlChange(ev) {
        this.setState({ issueUrl: ev.target.value });
    }

   _onSendLogsChange(ev) {
        this.setState({ sendLogs: ev.target.checked });
    }

    _sendProgressCallback(progress) {
        if (this._unmounted) {
            return;
        }
        this.setState({progress: progress});
    }

    render() {
        const Loader = sdk.getComponent("elements.Spinner");

        let error = null;
        if (this.state.err) {
            error = <div className="error">
                {this.state.err}
            </div>;
        }

        let cancelButton = null;
        if (!this.state.busy) {
            cancelButton = <button onClick={this._onCancel}>
                { _t("Cancel") }
            </button>;
        }

        let progress = null;
        if (this.state.busy) {
            progress = (
                <div className="progress">
                    <Loader />
                    {this.state.progress} ...
                </div>
            );
        }

        return (
            <div className="mx_BugReportDialog">
                <div className="mx_Dialog_title">
                    { _t("Submit debug logs") }
                </div>
                <div className="mx_Dialog_content">
                    <p>
                        { _t(
                            "Debug logs contain application usage data including your " +
                            "username, the IDs or aliases of the rooms or groups you " +
                            "have visited and the usernames of other users. They do " +
                            "not contain messages.",
                        ) }
                    </p>
                    <p>
                        { _t(
                            "<a>Click here</a> to create a GitHub issue.",
                            {},
                            {
                                a: (sub) => <a
                                    target="_blank"
                                    href="https://github.com/vector-im/riot-web/issues/new"
                                >
                                    { sub }
                                </a>,
                            },
                        ) }
                    </p>
                    <div className="mx_BugReportDialog_field_container">
                        <label
                            htmlFor="mx_BugReportDialog_issueUrl"
                            className="mx_BugReportDialog_field_label"
                        >
                            { _t("GitHub issue link:") }
                        </label>
                        <input
                            id="mx_BugReportDialog_issueUrl"
                            type="text"
                            className="mx_BugReportDialog_field_input"
                            onChange={this._onIssueUrlChange}
                            value={this.state.issueUrl}
                            placeholder="https://github.com/vector-im/riot-web/issues/1337"
                        />
                    </div>
                    <div className="mx_BugReportDialog_field_container">
                        <label
                            htmlFor="mx_BugReportDialog_notes_label"
                            className="mx_BugReportDialog_field_label"
                        >
                            { _t("Notes:") }
                        </label>
                        <textarea
                            className="mx_BugReportDialog_field_input"
                            rows={5}
                            onChange={this._onTextChange}
                            value={this.state.text}
                        />
                    </div>
                    {progress}
                    {error}
                </div>
                <div className="mx_Dialog_buttons">
                    <button
                        className="mx_Dialog_primary danger"
                        onClick={this._onSubmit}
                        autoFocus={true}
                        disabled={this.state.busy}
                    >
                        { _t("Send logs") }
                    </button>

                    {cancelButton}
                </div>
            </div>
        );
    }
}

BugReportDialog.propTypes = {
    onFinished: React.PropTypes.func.isRequired,
};
