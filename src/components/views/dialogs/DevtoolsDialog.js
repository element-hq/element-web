/*
Copyright 2017 OpenMarket Ltd

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
import sdk from 'matrix-react-sdk';
import Modal from 'matrix-react-sdk/lib/Modal';
import MatrixClientPeg from 'matrix-react-sdk/lib/MatrixClientPeg';

class SendCustomEvent extends React.Component {
    static propTypes = {
        roomId: React.PropTypes.string.isRequired,
        onFinished: React.PropTypes.func.isRequired,
    };

    constructor(props, context) {
        super(props, context);
        this._send = this._send.bind(this);
        this.onCancel = this.onCancel.bind(this);
    }

    async _send() {
        try {
            const content = JSON.parse(this.refs.evContent.value);
            await MatrixClientPeg.get().sendEvent(this.refs.roomId.value, this.refs.eventType.value, content);
            this.props.onFinished(true);
        } catch (e) {
            this.props.onFinished(false);
            const ErrorDialog = sdk.getComponent('dialogs.ErrorDialog');
            Modal.createDialog(ErrorDialog, {
                title: 'Failed to send custom event',
                description: e.toString(),
            });
        }
    }

    onCancel() {
        this.props.onFinished(false);
    }

    render() {
        return <div>
            <div className="mx_Dialog_content">
                <div className="mx_TextInputDialog_label">
                    <label htmlFor="roomId"> Room ID </label>
                </div>
                <div>
                    <input id="roomId" ref="roomId" className="mx_TextInputDialog_input" defaultValue={this.props.roomId} size="64" />
                </div>

                <div className="mx_TextInputDialog_label">
                    <label htmlFor="eventType"> Event Type </label>
                </div>
                <div>
                    <input id="eventType" ref="eventType" className="mx_TextInputDialog_input" size="64" />
                </div>

                <div className="mx_TextInputDialog_label">
                    <label htmlFor="evContent"> Event Content </label>
                </div>
                <div>
                    <textarea id="evContent" ref="evContent" className="mx_TextInputDialog_input" defaultValue={"{\n\n}"} size="64" />
                </div>
            </div>
            <div className="mx_Dialog_buttons">
                <button onClick={this._send}>Send</button>
                <button onClick={this.onCancel}>Cancel</button>
            </div>
        </div>;
    }
}

class SendCustomStateEvent extends React.Component {
    static propTypes = {
        roomId: React.PropTypes.string.isRequired,
        onFinished: React.PropTypes.func.isRequired,
    };

    constructor(props, context) {
        super(props, context);
        this._send = this._send.bind(this);
        this.onCancel = this.onCancel.bind(this);
    }

    async _send() {
        try {
            const content = JSON.parse(this.refs.evContent.value);
            await MatrixClientPeg.get().sendStateEvent(this.refs.roomId.value, this.refs.eventType.value, content, this.refs.stateKey.value);
            this.props.onFinished(true);
        } catch (e) {
            this.props.onFinished(false);
            const ErrorDialog = sdk.getComponent('dialogs.ErrorDialog');
            Modal.createDialog(ErrorDialog, {
                title: 'Failed to send custom event',
                description: e.toString(),
            });
        }
    }

    onCancel() {
        this.props.onFinished(false);
    }

    render() {
        return <div>
            <div className="mx_Dialog_content">
                <div className="mx_TextInputDialog_label">
                    <label htmlFor="roomId"> Room ID </label>
                </div>
                <div>
                    <input id="roomId" ref="roomId" className="mx_TextInputDialog_input" defaultValue={this.props.roomId} size="64" />
                </div>

                <div className="mx_TextInputDialog_label">
                    <label htmlFor="stateKey"> State Key </label>
                </div>
                <div>
                    <input id="stateKey" ref="stateKey" className="mx_TextInputDialog_input" size="64" />
                </div>

                <div className="mx_TextInputDialog_label">
                    <label htmlFor="eventType"> Event Type </label>
                </div>
                <div>
                    <input id="eventType" ref="eventType" className="mx_TextInputDialog_input" size="64" />
                </div>

                <div className="mx_TextInputDialog_label">
                    <label htmlFor="evContent"> Event Content </label>
                </div>
                <div>
                    <textarea id="evContent" ref="evContent" className="mx_TextInputDialog_input" defaultValue={"{\n\n}"} size="64" />
                </div>
            </div>
            <div className="mx_Dialog_buttons">
                <button onClick={this._send}>Send</button>
                <button onClick={this.onCancel}>Cancel</button>
            </div>
        </div>;
    }
}

export default class DevtoolsDialog extends React.Component {
    static propTypes = {
        roomId: React.PropTypes.string.isRequired,
        onFinished: React.PropTypes.func.isRequired,
    };

    state = {
        mode: null,
    };

    constructor(props, context) {
        super(props, context);
        this.onCancel = this.onCancel.bind(this);
    }

    componentWillUnmount() {
        this._unmounted = true;
    }

    _setMode(mode) {
        return () => {
            this.setState({ mode });
        };
    }

    onCancel() {
        this.props.onFinished(false);
    }

    render() {
        let body;

        if (this.state.mode) {
            body = <this.state.mode {...this.props} />;
        } else {
            body = <div>
                <div className="mx_Dialog_content">
                    <button onClick={this._setMode(SendCustomEvent)}>Send Custom Event</button>
                    <button onClick={this._setMode(SendCustomStateEvent)}>Send Custom State Event</button>
                </div>
                <div className="mx_Dialog_buttons">
                    <button onClick={this.onCancel}>Cancel</button>
                </div>
            </div>;
        }

        const BaseDialog = sdk.getComponent('views.dialogs.BaseDialog');
        return <BaseDialog className="mx_QuestionDialog" onFinished={this.props.onFinished} title="Developer Tools">
            { body }
        </BaseDialog>;
    }
}
