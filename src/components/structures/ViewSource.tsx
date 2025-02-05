/*
Copyright 2024 New Vector Ltd.
Copyright 2019 Michael Telatynski <7t3chguy@gmail.com>
Copyright 2015, 2016 , 2019, 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { type MatrixEvent } from "matrix-js-sdk/src/matrix";

import SyntaxHighlight from "../views/elements/SyntaxHighlight";
import { _t } from "../../languageHandler";
import MatrixClientContext from "../../contexts/MatrixClientContext";
import { canEditContent } from "../../utils/EventUtils";
import { MatrixClientPeg } from "../../MatrixClientPeg";
import BaseDialog from "../views/dialogs/BaseDialog";
import { DevtoolsContext } from "../views/dialogs/devtools/BaseTool";
import { StateEventEditor } from "../views/dialogs/devtools/RoomState";
import { stringify, TimelineEventEditor } from "../views/dialogs/devtools/Event";
import CopyableText from "../views/elements/CopyableText";

interface IProps {
    mxEvent: MatrixEvent; // the MatrixEvent associated with the context menu
    ignoreEdits?: boolean;
    onFinished(): void;
}

interface IState {
    isEditing: boolean;
}

export default class ViewSource extends React.Component<IProps, IState> {
    public constructor(props: IProps) {
        super(props);

        this.state = {
            isEditing: false,
        };
    }

    private onBack = (): void => {
        // TODO: refresh the "Event ID:" modal header
        this.setState({ isEditing: false });
    };

    private onEdit(): void {
        this.setState({ isEditing: true });
    }

    // returns the dialog body for viewing the event source
    private viewSourceContent(): JSX.Element {
        let mxEvent = this.props.mxEvent.replacingEvent() || this.props.mxEvent; // show the replacing event, not the original, if it is an edit
        if (this.props.ignoreEdits) {
            mxEvent = this.props.mxEvent;
        }

        const isEncrypted = mxEvent.isEncrypted();
        // @ts-ignore
        const decryptedEventSource = mxEvent.clearEvent; // FIXME: clearEvent is private
        const originalEventSource = mxEvent.event;
        const copyOriginalFunc = (): string => {
            return stringify(originalEventSource);
        };
        if (isEncrypted) {
            const copyDecryptedFunc = (): string => {
                return stringify(decryptedEventSource || {});
            };
            return (
                <>
                    <details open className="mx_ViewSource_details">
                        <summary>
                            <span className="mx_ViewSource_heading">
                                {_t("devtools|view_source_decrypted_event_source")}
                            </span>
                        </summary>
                        {decryptedEventSource ? (
                            <CopyableText getTextToCopy={copyDecryptedFunc}>
                                <SyntaxHighlight language="json">{stringify(decryptedEventSource)}</SyntaxHighlight>
                            </CopyableText>
                        ) : (
                            <div>{_t("devtools|view_source_decrypted_event_source_unavailable")}</div>
                        )}
                    </details>
                    <details className="mx_ViewSource_details">
                        <summary>
                            <span className="mx_ViewSource_heading">{_t("devtools|original_event_source")}</span>
                        </summary>
                        <CopyableText getTextToCopy={copyOriginalFunc}>
                            <SyntaxHighlight language="json">{stringify(originalEventSource)}</SyntaxHighlight>
                        </CopyableText>
                    </details>
                </>
            );
        } else {
            return (
                <>
                    <div className="mx_ViewSource_heading">{_t("devtools|original_event_source")}</div>
                    <CopyableText getTextToCopy={copyOriginalFunc}>
                        <SyntaxHighlight language="json">{stringify(originalEventSource)}</SyntaxHighlight>
                    </CopyableText>
                </>
            );
        }
    }

    // returns the SendCustomEvent component prefilled with the correct details
    private editSourceContent(): JSX.Element {
        const mxEvent = this.props.mxEvent.replacingEvent() || this.props.mxEvent; // show the replacing event, not the original, if it is an edit

        const isStateEvent = mxEvent.isState();
        const roomId = mxEvent.getRoomId();

        if (isStateEvent) {
            return (
                <MatrixClientContext.Consumer>
                    {(cli) => (
                        <DevtoolsContext.Provider value={{ room: cli.getRoom(roomId)! }}>
                            <StateEventEditor onBack={this.onBack} mxEvent={mxEvent} />
                        </DevtoolsContext.Provider>
                    )}
                </MatrixClientContext.Consumer>
            );
        }

        return (
            <MatrixClientContext.Consumer>
                {(cli) => (
                    <DevtoolsContext.Provider value={{ room: cli.getRoom(roomId)! }}>
                        <TimelineEventEditor onBack={this.onBack} mxEvent={mxEvent} />
                    </DevtoolsContext.Provider>
                )}
            </MatrixClientContext.Consumer>
        );
    }

    private canSendStateEvent(mxEvent: MatrixEvent): boolean {
        const cli = MatrixClientPeg.safeGet();
        const room = cli.getRoom(mxEvent.getRoomId());
        return !!room?.currentState.mayClientSendStateEvent(mxEvent.getType(), cli);
    }

    public render(): React.ReactNode {
        const mxEvent = this.props.mxEvent.replacingEvent() || this.props.mxEvent; // show the replacing event, not the original, if it is an edit

        const isEditing = this.state.isEditing;
        const roomId = mxEvent.getRoomId()!;
        const eventId = mxEvent.getId()!;
        const canEdit = mxEvent.isState()
            ? this.canSendStateEvent(mxEvent)
            : canEditContent(MatrixClientPeg.safeGet(), this.props.mxEvent);
        return (
            <BaseDialog className="mx_ViewSource" onFinished={this.props.onFinished} title={_t("action|view_source")}>
                <div className="mx_ViewSource_header">
                    <CopyableText getTextToCopy={() => roomId} border={false}>
                        {_t("devtools|room_id", { roomId })}
                    </CopyableText>
                    <CopyableText getTextToCopy={() => eventId} border={false}>
                        {_t("devtools|event_id", { eventId })}
                    </CopyableText>
                    {mxEvent.threadRootId && (
                        <CopyableText getTextToCopy={() => mxEvent.threadRootId!} border={false}>
                            {_t("devtools|thread_root_id", {
                                threadRootId: mxEvent.threadRootId,
                            })}
                        </CopyableText>
                    )}
                </div>
                {isEditing ? this.editSourceContent() : this.viewSourceContent()}
                {!isEditing && canEdit && (
                    <div className="mx_Dialog_buttons">
                        <button onClick={() => this.onEdit()}>{_t("action|edit")}</button>
                    </div>
                )}
            </BaseDialog>
        );
    }
}
