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
export default class ConfirmAndWaitRedactDialog extends React.PureComponent {
    constructor(props) {
        super(props);
        this.state = {
            isRedacting: false,
            redactionErrorCode: null,
        };
    }

    onParentFinished = async (proceed) => {
        if (proceed) {
            this.setState({isRedacting: true});
            try {
                await this.props.redact();
                this.props.onFinished(true);
            } catch (error) {
                const code = error.errcode || error.statusCode;
                if (typeof code !== "undefined") {
                    this.setState({redactionErrorCode: code});
                } else {
                    this.props.onFinished(true);
                }
            }
        } else {
            this.props.onFinished(false);
        }
    };

    render() {
        if (this.state.isRedacting) {
            if (this.state.redactionErrorCode) {
                const ErrorDialog = sdk.getComponent("dialogs.ErrorDialog");
                const code = this.state.redactionErrorCode;
                return (
                    <ErrorDialog
                        onFinished={this.props.onFinished}
                        title={_t('Error')}
                        description={_t('You cannot delete this message. (%(code)s)', {code})}
                    />
                );
            } else {
                const BaseDialog = sdk.getComponent("dialogs.BaseDialog");
                const Spinner = sdk.getComponent('elements.Spinner');
                return (
                    <BaseDialog
                        onFinished={this.props.onFinished}
                        hasCancel={false}
                        title={_t("Removing…")}>
                        <Spinner />
                    </BaseDialog>
                );
            }
        } else {
            const ConfirmRedactDialog = sdk.getComponent("dialogs.ConfirmRedactDialog");
            return <ConfirmRedactDialog onFinished={this.onParentFinished} />;
        }
    }
}
