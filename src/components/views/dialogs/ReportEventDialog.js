/*
Copyright 2019 Michael Telatynski <7t3chguy@gmail.com>

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

import React, {PureComponent} from 'react';
import * as sdk from '../../../index';
import { _t } from '../../../languageHandler';
import PropTypes from "prop-types";
import {MatrixEvent} from "matrix-js-sdk";
import {MatrixClientPeg} from "../../../MatrixClientPeg";
import SdkConfig from '../../../SdkConfig';
import Markdown from '../../../Markdown';

/*
 * A dialog for reporting an event.
 */
export default class ReportEventDialog extends PureComponent {
    static propTypes = {
        mxEvent: PropTypes.instanceOf(MatrixEvent).isRequired,
        onFinished: PropTypes.func.isRequired,
    };

    constructor(props) {
        super(props);

        this.state = {
            reason: "",
            busy: false,
            err: null,
        };
    }

    _onReasonChange = ({target: {value: reason}}) => {
        this.setState({ reason });
    };

    _onCancel = () => {
        this.props.onFinished(false);
    };

    _onSubmit = async () => {
        if (!this.state.reason || !this.state.reason.trim()) {
            this.setState({
                err: _t("Please fill why you're reporting."),
            });
            return;
        }

        this.setState({
            busy: true,
            err: null,
        });

        try {
            const ev = this.props.mxEvent;
            await MatrixClientPeg.get().reportEvent(ev.getRoomId(), ev.getId(), -100, this.state.reason.trim());
            this.props.onFinished(true);
        } catch (e) {
            this.setState({
                busy: false,
                err: e.message,
            });
        }
    };

    render() {
        const BaseDialog = sdk.getComponent('views.dialogs.BaseDialog');
        const DialogButtons = sdk.getComponent('views.elements.DialogButtons');
        const Loader = sdk.getComponent('elements.Spinner');
        const Field = sdk.getComponent('elements.Field');

        let error = null;
        if (this.state.err) {
            error = <div className="error">
                {this.state.err}
            </div>;
        }

        let progress = null;
        if (this.state.busy) {
            progress = (
                <div className="progress">
                    <Loader />
                </div>
            );
        }

        const adminMessageMD =
            SdkConfig.get().reportEvent &&
            SdkConfig.get().reportEvent.adminMessageMD;
        let adminMessage;
        if (adminMessageMD) {
            const html = new Markdown(adminMessageMD).toHTML({ externalLinks: true });
            adminMessage = <p dangerouslySetInnerHTML={{ __html: html }} />;
        }

        return (
            <BaseDialog
                className="mx_BugReportDialog"
                onFinished={this.props.onFinished}
                title={_t('Report Content to Your Homeserver Administrator')}
                contentId='mx_ReportEventDialog'
            >
                <div className="mx_ReportEventDialog" id="mx_ReportEventDialog">
                    <p>
                        {
                            _t("Reporting this message will send its unique 'event ID' to the administrator of " +
                                "your homeserver. If messages in this room are encrypted, your homeserver " +
                                "administrator will not be able to read the message text or view any files or images.")
                        }
                    </p>
                    {adminMessage}
                    <Field
                        className="mx_ReportEventDialog_reason"
                        element="textarea"
                        label={_t("Reason")}
                        rows={5}
                        onChange={this._onReasonChange}
                        value={this.state.reason}
                        disabled={this.state.busy}
                    />
                    {progress}
                    {error}
                </div>
                <DialogButtons
                    primaryButton={_t("Send report")}
                    onPrimaryButtonClick={this._onSubmit}
                    focus={true}
                    onCancel={this._onCancel}
                    disabled={this.state.busy}
                />
            </BaseDialog>
        );
    }
}
