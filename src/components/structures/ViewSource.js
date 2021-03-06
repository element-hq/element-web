/*
Copyright 2015, 2016 OpenMarket Ltd
Copyright 2019 Michael Telatynski <7t3chguy@gmail.com>
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
import PropTypes from "prop-types";
import SyntaxHighlight from "../views/elements/SyntaxHighlight";
import { _t } from "../../languageHandler";
import * as sdk from "../../index";
import MatrixClientContext from "../../contexts/MatrixClientContext";
import { SendCustomEvent } from "../views/dialogs/DevtoolsDialog";

export default class ViewSource extends React.Component {
    static propTypes = {
        onFinished: PropTypes.func.isRequired,
        mxEvent: PropTypes.object.isRequired, // the MatrixEvent associated with the context menu
    };

    constructor(props) {
        super(props);

        this.state = {
            isEditing: false,
        };
    }

    onBack() {
        this.setState({ isEditing: false });
    }

    onEdit() {
        this.setState({ isEditing: true });
    }

    // returns the dialog body for viewing the event source
    viewSourceContent() {
        const mxEvent = this.props.mxEvent.replacingEvent() || this.props.mxEvent; // show the replacing event, not the original, if it is an edit
        const isEncrypted = this.props.mxEvent.getType() !== this.props.mxEvent.getWireType();
        const decryptedEventSource = mxEvent._clearEvent; // FIXME: _clearEvent is private
        const originalEventSource = mxEvent.event;

        if (isEncrypted) {
            return (
                <>
                    <details open className="mx_ViewSource_details">
                        <summary>
                            <span className="mx_ViewSource_heading">{_t("Decrypted event source")}</span>
                        </summary>
                        <SyntaxHighlight className="json">{JSON.stringify(decryptedEventSource, null, 2)}</SyntaxHighlight>
                    </details>
                    <details className="mx_ViewSource_details">
                        <summary>
                            <span className="mx_ViewSource_heading">{_t("Original event source")}</span>
                        </summary>
                        <SyntaxHighlight className="json">{JSON.stringify(originalEventSource, null, 2)}</SyntaxHighlight>
                    </details>
                </>
            );
        } else {
            return (
                <>
                    <div className="mx_ViewSource_heading">{_t("Original event source")}</div>
                    <SyntaxHighlight className="json">{JSON.stringify(originalEventSource, null, 2)}</SyntaxHighlight>
                </>
            );
        }
    }

    // returns the SendCustomEvent component prefilled with the correct details
    editSourceContent() {
        const mxEvent = this.props.mxEvent.replacingEvent() || this.props.mxEvent; // show the replacing event, not the original, if it is an edit

        const isStateEvent = mxEvent.isState();
        console.log("isStateEvent", isStateEvent);
        const roomId = mxEvent.getRoomId();
        const eventId = mxEvent.getId();
        const originalContent = mxEvent.getContent();
        if (isStateEvent) {
            return (
                <MatrixClientContext.Consumer>
                    {(cli) => (
                        <SendCustomEvent
                            room={cli.getRoom(roomId)}
                            forceStateEvent={true}
                            onBack={() => this.onBack()}
                            inputs={{
                                eventType: mxEvent.getType(),
                                evContent: JSON.stringify(originalContent, null, "\t"),
                                stateKey: mxEvent.getStateKey(),
                            }}
                        />
                    )}
                </MatrixClientContext.Consumer>
            );
        } else {
            // send an edit-message event
            // prefill the "m.new_content" field
            const newContent = {
                ...originalContent,
                "m.new_content": originalContent,
                "m.relates_to": {
                    rel_type: "m.replace",
                    event_id: eventId,
                },
            };
            return (
                <MatrixClientContext.Consumer>
                    {(cli) => (
                        <SendCustomEvent
                            room={cli.getRoom(roomId)}
                            forceStateEvent={false}
                            forceGeneralEvent={true}
                            onBack={() => this.onBack()}
                            inputs={{
                                eventType: mxEvent.getType(),
                                evContent: JSON.stringify(newContent, null, "\t"),
                            }}
                        />
                    )}
                </MatrixClientContext.Consumer>
            );
        }
    }

    render() {
        const BaseDialog = sdk.getComponent("views.dialogs.BaseDialog");
        const mxEvent = this.props.mxEvent.replacingEvent() || this.props.mxEvent; // show the replacing event, not the original, if it is an edit

        const isEditing = this.state.isEditing;
        const roomId = mxEvent.getRoomId();
        const eventId = mxEvent.getId();
        return (
            <BaseDialog className="mx_ViewSource" onFinished={this.props.onFinished} title={_t("View Source")}>
                <div>
                    <div className="mx_ViewSource_label_left">Room ID: {roomId}</div>
                    <div className="mx_ViewSource_label_left">Event ID: {eventId}</div>
                    <div className="mx_ViewSource_separator" />
                    {isEditing ? this.editSourceContent() : this.viewSourceContent()}
                </div>
                {!isEditing && (
                    <div className="mx_Dialog_buttons">
                        <button onClick={() => this.onEdit()}>{_t("Edit")}</button>
                    </div>
                )}
            </BaseDialog>
        );
    }
}
