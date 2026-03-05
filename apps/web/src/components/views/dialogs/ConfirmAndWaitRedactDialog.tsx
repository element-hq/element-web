/*
Copyright 2024 New Vector Ltd.
Copyright 2019 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { type MatrixEvent, HTTPError, MatrixError } from "matrix-js-sdk/src/matrix";

import { _t } from "../../../languageHandler";
import ConfirmRedactDialog from "./ConfirmRedactDialog";
import ErrorDialog from "./ErrorDialog";
import BaseDialog from "./BaseDialog";
import Spinner from "../elements/Spinner";

interface IProps {
    event: MatrixEvent;
    redact: () => Promise<void>;
    onFinished: (success?: boolean) => void;
}

interface IState {
    isRedacting: boolean;
    redactionErrorCode: string | number | null;
}

/*
 * A dialog for confirming a redaction.
 * Also shows a spinner (and possible error) while the redaction is ongoing,
 * and only closes the dialog when the redaction is done or failed.
 *
 * This is done to prevent the edit history dialog racing with the redaction:
 * if this dialog closes and the MessageEditHistoryDialog is shown again,
 * it will fetch the relations again, which will race with the ongoing /redact request.
 * which will cause the edit to appear unredacted.
 *
 * To avoid this, we keep the dialog open as long as /redact is in progress.
 */
export default class ConfirmAndWaitRedactDialog extends React.PureComponent<IProps, IState> {
    public constructor(props: IProps) {
        super(props);
        this.state = {
            isRedacting: false,
            redactionErrorCode: null,
        };
    }

    public onParentFinished = async (proceed?: boolean): Promise<void> => {
        if (proceed) {
            this.setState({ isRedacting: true });
            try {
                await this.props.redact();
                this.props.onFinished(true);
            } catch (error) {
                let code: string | number | undefined;
                if (error instanceof MatrixError) {
                    code = error.errcode;
                } else if (error instanceof HTTPError) {
                    code = error.httpStatus;
                }

                if (typeof code !== "undefined") {
                    this.setState({ redactionErrorCode: code });
                } else {
                    this.props.onFinished(true);
                }
            }
        } else {
            this.props.onFinished(false);
        }
    };

    public render(): React.ReactNode {
        if (this.state.isRedacting) {
            if (this.state.redactionErrorCode) {
                const code = this.state.redactionErrorCode;
                return (
                    <ErrorDialog
                        onFinished={this.props.onFinished}
                        title={_t("common|error")}
                        description={_t("redact|error", { code })}
                    />
                );
            } else {
                return (
                    <BaseDialog onFinished={this.props.onFinished} hasCancel={false} title={_t("redact|ongoing")}>
                        <Spinner />
                    </BaseDialog>
                );
            }
        } else {
            return <ConfirmRedactDialog event={this.props.event} onFinished={this.onParentFinished} />;
        }
    }
}
