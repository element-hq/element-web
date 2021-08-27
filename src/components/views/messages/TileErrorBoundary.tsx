/*
Copyright 2020 - 2021 The Matrix.org Foundation C.I.C.

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
import classNames from 'classnames';
import { MatrixEvent } from "matrix-js-sdk/src/models/event";

import { _t } from '../../../languageHandler';
import Modal from '../../../Modal';
import SdkConfig from "../../../SdkConfig";
import { replaceableComponent } from "../../../utils/replaceableComponent";
import BugReportDialog from '../dialogs/BugReportDialog';

interface IProps {
    mxEvent: MatrixEvent;
}

interface IState {
    error: Error;
}

@replaceableComponent("views.messages.TileErrorBoundary")
export default class TileErrorBoundary extends React.Component<IProps, IState> {
    constructor(props) {
        super(props);

        this.state = {
            error: null,
        };
    }

    static getDerivedStateFromError(error: Error): Partial<IState> {
        // Side effects are not permitted here, so we only update the state so
        // that the next render shows an error message.
        return { error };
    }

    private onBugReport = (): void => {
        Modal.createTrackedDialog('Bug Report Dialog', '', BugReportDialog, {
            label: 'react-soft-crash-tile',
            error: this.state.error,
        });
    };

    render() {
        if (this.state.error) {
            const { mxEvent } = this.props;
            const classes = {
                mx_EventTile: true,
                mx_EventTile_info: true,
                mx_EventTile_content: true,
                mx_EventTile_tileError: true,
            };

            let submitLogsButton;
            if (SdkConfig.get().bug_report_endpoint_url) {
                submitLogsButton = <a onClick={this.onBugReport} href="#">
                    { _t("Submit logs") }
                </a>;
            }

            return (<div className={classNames(classes)}>
                <div className="mx_EventTile_line">
                    <span>
                        { _t("Can't load this message") }
                        { mxEvent && ` (${mxEvent.getType()})` }
                        { submitLogsButton }
                    </span>
                </div>
            </div>);
        }

        return this.props.children;
    }
}
