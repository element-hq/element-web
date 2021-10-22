/*
Copyright 2017 Vector Creations Ltd

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

import { MatrixEvent } from 'matrix-js-sdk/src/models/event';
import React from 'react';

import { _t } from '../../../languageHandler';
import { MatrixClientPeg } from '../../../MatrixClientPeg';
import Modal from '../../../Modal';
import { replaceableComponent } from "../../../utils/replaceableComponent";
import ErrorDialog from './ErrorDialog';
import TextInputDialog from "./TextInputDialog";

interface IProps {
    onFinished: (success: boolean) => void;
}

/*
 * A dialog for confirming a redaction.
 */
@replaceableComponent("views.dialogs.ConfirmRedactDialog")
export default class ConfirmRedactDialog extends React.Component<IProps> {
    render() {
        return (
            <TextInputDialog onFinished={this.props.onFinished}
                title={_t("Confirm Removal")}
                description={
                    _t("Are you sure you wish to remove (delete) this event? " +
                       "Note that if you delete a room name or topic change, it could undo the change.")}
                placeholder={_t("Reason (optional)")}
                focus
                button={_t("Remove")}
            />
        );
    }
}

export function createRedactEventDialog({
    mxEvent,
    onCloseDialog = () => {},
}: {
    mxEvent: MatrixEvent;
    onCloseDialog?: () => void;
}) {
    Modal.createTrackedDialog('Confirm Redact Dialog', '', ConfirmRedactDialog, {
        onFinished: async (proceed: boolean, reason?: string) => {
            if (!proceed) return;

            const cli = MatrixClientPeg.get();
            try {
                onCloseDialog?.();
                await cli.redactEvent(
                    mxEvent.getRoomId(),
                    mxEvent.getId(),
                    undefined,
                    reason ? { reason } : {},
                );
            } catch (e) {
                const code = e.errcode || e.statusCode;
                // only show the dialog if failing for something other than a network error
                // (e.g. no errcode or statusCode) as in that case the redactions end up in the
                // detached queue and we show the room status bar to allow retry
                if (typeof code !== "undefined") {
                    // display error message stating you couldn't delete this.
                    Modal.createTrackedDialog('You cannot delete this message', '', ErrorDialog, {
                        title: _t('Error'),
                        description: _t('You cannot delete this message. (%(code)s)', { code }),
                    });
                }
            }
        },
    }, 'mx_Dialog_confirmredact');
}
