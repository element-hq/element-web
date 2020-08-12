/*
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

import React from 'react';
import * as sdk from '../../../index';
import { _t } from '../../../languageHandler';
import {MatrixClientPeg} from '../../../MatrixClientPeg';
import PlatformPeg from '../../../PlatformPeg';
import Modal from '../../../Modal';

/**
 * This error boundary component can be used to wrap large content areas and
 * catch exceptions during rendering in the component tree below them.
 */
export default class ErrorBoundary extends React.PureComponent {
    constructor(props) {
        super(props);

        this.state = {
            error: null,
        };
    }

    static getDerivedStateFromError(error) {
        // Side effects are not permitted here, so we only update the state so
        // that the next render shows an error message.
        return { error };
    }

    componentDidCatch(error, { componentStack }) {
        // Browser consoles are better at formatting output when native errors are passed
        // in their own `console.error` invocation.
        console.error(error);
        console.error(
            "The above error occured while React was rendering the following components:",
            componentStack,
        );
    }

    _onClearCacheAndReload = () => {
        if (!PlatformPeg.get()) return;

        MatrixClientPeg.get().stopClient();
        MatrixClientPeg.get().store.deleteAllData().then(() => {
            PlatformPeg.get().reload();
        });
    };

    _onBugReport = () => {
        const BugReportDialog = sdk.getComponent("dialogs.BugReportDialog");
        if (!BugReportDialog) {
            return;
        }
        Modal.createTrackedDialog('Bug Report Dialog', '', BugReportDialog, {
            label: 'react-soft-crash',
        });
    };

    render() {
        if (this.state.error) {
            const AccessibleButton = sdk.getComponent('elements.AccessibleButton');
            const newIssueUrl = "https://github.com/vector-im/element-web/issues/new";
            return <div className="mx_ErrorBoundary">
                <div className="mx_ErrorBoundary_body">
                    <h1>{_t("Something went wrong!")}</h1>
                    <p>{_t(
                        "Please <newIssueLink>create a new issue</newIssueLink> " +
                        "on GitHub so that we can investigate this bug.", {}, {
                            newIssueLink: (sub) => {
                                return <a target="_blank" rel="noreferrer noopener" href={newIssueUrl}>{ sub }</a>;
                            },
                        },
                    )}</p>
                    <p>{_t(
                        "If you've submitted a bug via GitHub, debug logs can help " +
                        "us track down the problem. Debug logs contain application " +
                        "usage data including your username, the IDs or aliases of " +
                        "the rooms or groups you have visited and the usernames of " +
                        "other users. They do not contain messages.",
                    )}</p>
                    <AccessibleButton onClick={this._onBugReport} kind='primary'>
                        {_t("Submit debug logs")}
                    </AccessibleButton>
                    <AccessibleButton onClick={this._onClearCacheAndReload} kind='danger'>
                        {_t("Clear cache and reload")}
                    </AccessibleButton>
                </div>
            </div>;
        }

        return this.props.children;
    }
}
