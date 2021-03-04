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
        content: PropTypes.object.isRequired,
        onFinished: PropTypes.func.isRequired,
        roomId: PropTypes.string.isRequired,
        eventId: PropTypes.string.isRequired,
        isEncrypted: PropTypes.bool.isRequired,
        decryptedContent: PropTypes.object,
        event: PropTypes.object.isRequired, // the MatrixEvent associated with the context menu
    };

    constructor(props) {
        super(props);

        this.state = {
            editComponent: null,
        };
    }

    onBack() {
        this.setState({ editComponent: null });
    }

    editEvent() {
        const isStateEvent = this.props.event.isState();
        console.log("isStateEvent", isStateEvent);
        if (isStateEvent) {
            this.setState({
                editComponent: (
                    <MatrixClientContext.Consumer>
                        {(cli) => (
                            <SendCustomEvent
                                room={cli.getRoom(this.props.roomId)}
                                forceStateEvent={true}
                                onBack={() => this.onBack()}
                                inputs={{
                                    eventType: this.props.event.getType(),
                                    evContent: JSON.stringify(this.props.event.getContent(), null, "\t"),
                                    stateKey: this.props.event.getStateKey(),
                                }}
                            />
                        )}
                    </MatrixClientContext.Consumer>
                ),
            });
        } else {
            // send an edit-message event
            // prefill the "m.new_content" field
            const originalContent = this.props.event.getContent();
            const originalEventId = this.props.eventId;
            const content = {
                ...originalContent,
                "m.new_content": originalContent,
                "m.relates_to": {
                    rel_type: "m.replace",
                    event_id: originalEventId,
                },
            };
            this.setState({
                editComponent: (
                    <MatrixClientContext.Consumer>
                        {(cli) => (
                            <SendCustomEvent
                                room={cli.getRoom(this.props.roomId)}
                                forceStateEvent={false}
                                forceGeneralEvent={true}
                                onBack={() => this.onBack()}
                                inputs={{
                                    eventType: this.props.event.getType(),
                                    evContent: JSON.stringify(content, null, "\t"),
                                }}
                            />
                        )}
                    </MatrixClientContext.Consumer>
                ),
            });
        }
    }

    render() {
        const BaseDialog = sdk.getComponent("views.dialogs.BaseDialog");

        let content;
        if (this.props.isEncrypted) {
            content = (
                <>
                    <details open className="mx_ViewSource_details">
                        <summary>
                            <span className="mx_ViewSource_heading">{_t("Decrypted event source")}</span>
                        </summary>
                        <SyntaxHighlight className="json">{JSON.stringify(this.props.decryptedContent, null, 2)}</SyntaxHighlight>
                    </details>
                    <details className="mx_ViewSource_details">
                        <summary>
                            <span className="mx_ViewSource_heading">{_t("Original event source")}</span>
                        </summary>
                        <SyntaxHighlight className="json">{JSON.stringify(this.props.content, null, 2)}</SyntaxHighlight>
                    </details>
                </>
            );
        } else {
            content = (
                <>
                    <div className="mx_ViewSource_heading">{_t("Original event source")}</div>
                    <SyntaxHighlight className="json">{JSON.stringify(this.props.content, null, 2)}</SyntaxHighlight>
                </>
            );
        }

        const isEditing = this.state.editComponent !== null;
        console.log(isEditing);

        return (
            <BaseDialog className="mx_ViewSource" onFinished={this.props.onFinished} title={_t("View Source")}>
                <div>
                    <div className="mx_ViewSource_label_left">Room ID: {this.props.roomId}</div>
                    <div className="mx_ViewSource_label_left">Event ID: {this.props.eventId}</div>
                    <div className="mx_ViewSource_separator" />
                    {isEditing ? this.state.editComponent : content}
                </div>
                {!isEditing && (
                    <div className="mx_Dialog_buttons">
                        <button onClick={() => this.editEvent()}>{_t("Edit")}</button>
                    </div>
                )}
            </BaseDialog>
        );
    }
}
