/*
Copyright 2020 The Matrix.org Foundation C.I.C.

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
import QuestionDialog from './QuestionDialog';
import { _t } from "../../../languageHandler";
import { IDialogProps } from "./IDialogProps";

interface IProps extends IDialogProps {
    onFinished(): void;
}

interface IState {}

/*
 * A dialog for confirming closing the Element Pro setup dialog.
 */
export default class ElementProConfirmCloseDialog extends React.PureComponent<IProps, IState> {
    public render() {
        return (
            <QuestionDialog
                onFinished={this.props.onFinished}
                title={_t("Confirm Abort Of Host Creation")}
                description={_t(
                    "Are you sure you wish to abort creation of the host? The process cannot be continued.",
                )}
                button={_t("Abort")}
            />
        );
    }
}
