/*
Copyright 2019 New Vector Ltd

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
import SdkConfig from '../../../SdkConfig';
import { _t } from '../../../languageHandler';

// Dev note: this should be a temporary dialog while we work out what is
// actually going on. See https://github.com/vector-im/riot-web/issues/8593
// for more details. This dialog is almost entirely a copy/paste job of
// BugReportDialog.
export default class TimelineExplosionDialog extends React.Component {
    static propTypes = {
        onFinished: React.PropTypes.func.isRequired,
    };

    constructor(props, context) {
        super(props, context);
        this.state = {
            busy: false,
            progress: null,
        };
    }

    _onCancel() {
        console.log("Reloading without sending logs for timeline explosion");
        window.location.reload();
    }

    _onSubmit = () => {
        const userText = "Caught timeline explosion\n\nhttps://github.com/vector-im/riot-web/issues/8593";

        this.setState({busy: true, progress: null});
        this._sendProgressCallback(_t("Preparing to send logs"));

        require(['../../../rageshake/submit-rageshake'], (s) => {
            s(SdkConfig.get().bug_report_endpoint_url, {
                userText,
                sendLogs: true,
                progressCallback: this._sendProgressCallback,
            }).then(() => {
                console.log("Logs sent for timeline explosion - reloading Riot");
                window.location.reload();
            }, (err) => {
                console.error("Error sending logs for timeline explosion - reloading anyways.", err);
                window.location.reload();
            });
        });
    };

    _sendProgressCallback = (progress) => {
        this.setState({progress: progress});
    };

    render() {
        const Loader = sdk.getComponent("elements.Spinner");
        const BaseDialog = sdk.getComponent('views.dialogs.BaseDialog');
        const DialogButtons = sdk.getComponent('views.elements.DialogButtons');

        let progress = null;
        if (this.state.busy) {
            progress = (
                <div className="progress">
                    {this.state.progress} ...
                    <Loader />
                </div>
            );
        }

        return (
            <BaseDialog className="mx_TimelineExplosionDialog" onFinished={this._onCancel}
                        title={_t('Error showing you your room')} contentId='mx_Dialog_content'
            >
                <div className="mx_Dialog_content" id='mx_Dialog_content'>
                    <p>
                        {_t(
                            "Riot has run into a problem which makes it difficult to show you " +
                            "your messages right now. Nothing has been lost and reloading the app " +
                            "should fix this for you. In order to assist us in troubleshooting the " +
                            "problem, we'd like to take a look at your debug logs. You do not need " +
                            "to send your logs unless you want to, but we would really appreciate " +
                            "it if you did. We'd also like to apologize for having to show this " +
                            "message to you - we hope your debug logs are the key to solving the " +
                            "issue once and for all. If you'd like more information on the bug you've " +
                            "accidentally run into, please visit <a>the issue</a>.",
                            {},
                            {
                                'a': (sub) => {
                                    return <a href="https://github.com/vector-im/riot-web/issues/8593"
                                              target="_blank" rel="noopener">{sub}</a>;
                                },
                            },
                        )}
                    </p>
                    <p>
                        {_t(
                            "Debug logs contain application usage data including your " +
                            "username, the IDs or aliases of the rooms or groups you " +
                            "have visited and the usernames of other users. They do " +
                            "not contain messages.",
                        )}
                    </p>
                    {progress}
                </div>
                <DialogButtons primaryButton={_t("Send debug logs and reload Riot")}
                               onPrimaryButtonClick={this._onSubmit}
                               cancelButton={_t("Reload Riot without sending logs")}
                               focus={true}
                               onCancel={this._onCancel}
                               disabled={this.state.busy}
                />
            </BaseDialog>
        );
    }
}

