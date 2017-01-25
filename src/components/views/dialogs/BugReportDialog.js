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
import sdk from '../../../index';

export default class BugReportDialog extends React.Component {
    constructor(props, context) {
        super(props, context);
        this.state = {
            sendLogs: true,
            busy: false,
            err: null,
            text: "",
        };
        this._onSubmit = this._onSubmit.bind(this);
        this._onCancel = this._onCancel.bind(this);
        this._onTextChange = this._onTextChange.bind(this);
        this._onSendLogsChange = this._onSendLogsChange.bind(this);
    }

    _onCancel(ev) {
        this.props.onFinished(false);
    }

    _onSubmit(ev) {
        const sendLogs = this.state.sendLogs;
        const userText = this.state.text;
        if (!sendLogs && userText.trim().length === 0) {
            this.setState({
                err: "Please describe the bug and/or send logs.",
            });
            return;
        }
        // TODO: Make the HTTP hit
        this.setState({ busy: true, err: null });
        setTimeout(() => {
            this.setState({ busy: false, err: "No bug report endpoint." });
        }, 1000);
    }

    _onTextChange(ev) {
        this.setState({ text: ev.target.value });
    }

    _onSendLogsChange(ev) {
        this.setState({ sendLogs: ev.target.checked });
    }

    render() {
        const Loader = sdk.getComponent("elements.Spinner");

        let error = null;
        if (this.state.err) {
            error = <div className="error">
                {this.state.err}
            </div>;
        }

        const okLabel = this.state.busy ? <Loader /> : 'Send';

        let cancelButton = null;
        if (!this.state.busy) {
            cancelButton = <button onClick={this._onCancel}>
                Cancel
            </button>;
        }

        return (
            <div className="mx_BugReportDialog">
                <div className="mx_Dialog_title">
                    Report a bug
                </div>
                <div className="mx_Dialog_content">
                    <p>Please describe the bug. What did you do?
                    What did you expect to happen?
                    What actually happened?</p>
                    <textarea
                        className="mx_BugReportDialog_input"
                        rows={5}
                        onChange={this._onTextChange}
                        value={this.state.text}
                        placeholder="Describe your problem here."
                    />
                    <p>In order to diagnose problems, logs from this client will be sent with
                    this bug report.
                    If you would prefer to only send the text above, please untick:</p>
                    <input type="checkbox" checked={this.state.sendLogs}
                        onChange={this._onSendLogsChange} id="mx_BugReportDialog_logs"/>
                    <label htmlFor="mx_BugReportDialog_logs">Send logs</label>
                    {error}
                </div>
                <div className="mx_Dialog_buttons">
                    <button
                        className="mx_Dialog_primary danger"
                        onClick={this._onSubmit}
                        autoFocus={true}
                    >
                        {okLabel}
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
