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

import React from "react";

import { _t } from "../../../languageHandler";
import ConfirmRedactDialog from "./ConfirmRedactDialog";
import ErrorDialog from "./ErrorDialog";
import BaseDialog from "./BaseDialog";
import Spinner from "../elements/Spinner";

interface IProps {
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
                const code = error.errcode || error.statusCode;
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
                        title={_t("Error")}
                        description={_t("You cannot delete this message. (%(code)s)", { code })}
                    />
                );
            } else {
                return (
                    <BaseDialog onFinished={this.props.onFinished} hasCancel={false} title={_t("Removing…")}>
                        <Spinner />
                    </BaseDialog>
                );
            }
        } else {
            return <ConfirmRedactDialog onFinished={this.onParentFinished} />;
        }
    }
}
