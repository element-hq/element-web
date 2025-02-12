/*
Copyright 2024 New Vector Ltd.
Copyright 2020-2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type ReactNode } from "react";
import classNames from "classnames";
import { type MatrixEvent } from "matrix-js-sdk/src/matrix";

import { _t } from "../../../languageHandler";
import Modal from "../../../Modal";
import SdkConfig from "../../../SdkConfig";
import BugReportDialog from "../dialogs/BugReportDialog";
import AccessibleButton from "../elements/AccessibleButton";
import SettingsStore from "../../../settings/SettingsStore";
import ViewSource from "../../structures/ViewSource";
import { type Layout } from "../../../settings/enums/Layout";

interface IProps {
    mxEvent: MatrixEvent;
    layout: Layout;
    children: ReactNode;
}

interface IState {
    error?: Error;
}

export default class TileErrorBoundary extends React.Component<IProps, IState> {
    public constructor(props: IProps) {
        super(props);

        this.state = {};
    }

    public static getDerivedStateFromError(error: Error): Partial<IState> {
        // Side effects are not permitted here, so we only update the state so
        // that the next render shows an error message.
        return { error };
    }

    private onBugReport = (): void => {
        Modal.createDialog(BugReportDialog, {
            label: "react-soft-crash-tile",
            error: this.state.error,
        });
    };

    private onViewSource = (): void => {
        Modal.createDialog(
            ViewSource,
            {
                mxEvent: this.props.mxEvent,
            },
            "mx_Dialog_viewsource",
        );
    };

    public render(): ReactNode {
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
                submitLogsButton = (
                    <>
                        &nbsp;
                        <AccessibleButton kind="link" onClick={this.onBugReport}>
                            {_t("bug_reporting|submit_debug_logs")}
                        </AccessibleButton>
                    </>
                );
            }

            let viewSourceButton;
            if (mxEvent && SettingsStore.getValue("developerMode")) {
                viewSourceButton = (
                    <>
                        &nbsp;
                        <AccessibleButton onClick={this.onViewSource} kind="link">
                            {_t("action|view_source")}
                        </AccessibleButton>
                    </>
                );
            }

            return (
                <li className={classNames(classes)} data-layout={this.props.layout}>
                    <div className="mx_EventTile_line">
                        <span>
                            {_t("timeline|error_rendering_message")}
                            {mxEvent && ` (${mxEvent.getType()})`}
                            {submitLogsButton}
                            {viewSourceButton}
                        </span>
                    </div>
                </li>
            );
        }

        return this.props.children;
    }
}
