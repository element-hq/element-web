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

import { Feature, ServerSupport } from "matrix-js-sdk/src/feature";
import { IRedactOpts, MatrixEvent, RelationType } from "matrix-js-sdk/src/matrix";
import React from "react";

import { _t } from "../../../languageHandler";
import { MatrixClientPeg } from "../../../MatrixClientPeg";
import Modal from "../../../Modal";
import { isVoiceBroadcastStartedEvent } from "../../../voice-broadcast/utils/isVoiceBroadcastStartedEvent";
import ErrorDialog from "./ErrorDialog";
import TextInputDialog from "./TextInputDialog";

interface IProps {
    onFinished(success?: false, reason?: void): void;
    onFinished(success: true, reason?: string): void;
}

/*
 * A dialog for confirming a redaction.
 */
export default class ConfirmRedactDialog extends React.Component<IProps> {
    public render(): React.ReactNode {
        return (
            <TextInputDialog
                onFinished={this.props.onFinished}
                title={_t("Confirm Removal")}
                description={_t(
                    "Are you sure you wish to remove (delete) this event? " +
                        "Note that if you delete a room name or topic change, it could undo the change.",
                )}
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
}): void {
    const eventId = mxEvent.getId();

    if (!eventId) throw new Error("cannot redact event without ID");

    const roomId = mxEvent.getRoomId();

    if (!roomId) throw new Error(`cannot redact event ${mxEvent.getId()} without room ID`);
    Modal.createDialog(
        ConfirmRedactDialog,
        {
            onFinished: async (proceed, reason): Promise<void> => {
                if (!proceed) return;

                const cli = MatrixClientPeg.get();
                const withRelTypes: Pick<IRedactOpts, "with_rel_types"> = {};

                // redact related events if this is a voice broadcast started event and
                // server has support for relation based redactions
                if (isVoiceBroadcastStartedEvent(mxEvent)) {
                    const relationBasedRedactionsSupport = cli.canSupport.get(Feature.RelationBasedRedactions);
                    if (
                        relationBasedRedactionsSupport &&
                        relationBasedRedactionsSupport !== ServerSupport.Unsupported
                    ) {
                        withRelTypes.with_rel_types = [RelationType.Reference];
                    }
                }

                try {
                    onCloseDialog?.();
                    await cli.redactEvent(roomId, eventId, undefined, {
                        ...(reason ? { reason } : {}),
                        ...withRelTypes,
                    });
                } catch (e: any) {
                    const code = e.errcode || e.statusCode;
                    // only show the dialog if failing for something other than a network error
                    // (e.g. no errcode or statusCode) as in that case the redactions end up in the
                    // detached queue and we show the room status bar to allow retry
                    if (typeof code !== "undefined") {
                        // display error message stating you couldn't delete this.
                        Modal.createDialog(ErrorDialog, {
                            title: _t("Error"),
                            description: _t("You cannot delete this message. (%(code)s)", { code }),
                        });
                    }
                }
            },
        },
        "mx_Dialog_confirmredact",
    );
}
