/*
Copyright 2017 Michael Telatynski <7t3chguy@gmail.com>

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
import { _t } from 'matrix-react-sdk/lib/languageHandler';
import MatrixClientPeg from 'matrix-react-sdk/lib/MatrixClientPeg';

class SendCustomEvent extends React.Component {
    static propTypes = {
        roomId: React.PropTypes.string.isRequired,
        onBack: React.PropTypes.func.isRequired,
    };

    constructor(props, context) {
        super(props, context);
        this._send = this._send.bind(this);
        this.onBack = this.onBack.bind(this);
    }

    state = {
        message: null,
    };

    onBack() {
        if (this.state.message) {
            this.setState({ message: null });
        } else {
            this.props.onBack();
        }
    }

    _buttons() {
        return <div className="mx_Dialog_buttons">
            <button onClick={this.onBack}>{ _t('Back') }</button>
            {!this.state.message && <button onClick={this._send}>{ _t('Send') }</button>}
        </div>;
    }

    send(content) {
        return MatrixClientPeg.get().sendEvent(this.props.roomId, this.refs.eventType.value, content);
    }

    async _send() {
        let message;
        try {
            const content = JSON.parse(this.refs.evContent.value);
            await this.send(content);
            message = _t('Event sent!');
        } catch (e) {
            message = _t('Failed to send custom event.') + ' (' + e.toString() + ')';
        }
        this.setState({ message });
    }

    _additionalFields() {
        return <div></div>;
    }

    render() {
        if (this.state.message) {
            return <div>
                <div className="mx_Dialog_content">
                    {this.state.message}
                </div>
                {this._buttons()}
            </div>;
        }

        return <div>
            <div className="mx_Dialog_content">
                {this._additionalFields()}
                <div className="mx_TextInputDialog_label">
                    <label htmlFor="eventType"> { _t('Event Type') } </label>
                </div>
                <div>
                    <input id="eventType" ref="eventType" className="mx_TextInputDialog_input" size="64" />
                </div>

                <div className="mx_TextInputDialog_label">
                    <label htmlFor="evContent"> { _t('Event Content') } </label>
                </div>
                <div>
                    <textarea id="evContent" ref="evContent" className="mx_TextInputDialog_input" defaultValue={"{\n\n}"} cols="63" rows="5" />
                </div>
            </div>
            {this._buttons()}
        </div>;
    }
}

class SendCustomStateEvent extends SendCustomEvent {
    send(content) {
        return MatrixClientPeg.get().sendStateEvent(this.props.roomId, this.refs.eventType.value, content,
            this.refs.stateKey.value);
    }

    _additionalFields() {
        return <div>
            <div className="mx_TextInputDialog_label">
                <label htmlFor="stateKey"> { _t('State Key') } </label>
            </div>
            <div>
                <input id="stateKey" ref="stateKey" className="mx_TextInputDialog_input" size="64" />
            </div>
        </div>;
    }
}

class RoomStateExplorer extends React.Component {
    static propTypes = {
        roomId: React.PropTypes.string.isRequired,
        onBack: React.PropTypes.func.isRequired,
    };

    constructor(props, context) {
        super(props, context);

        const room = MatrixClientPeg.get().getRoom(this.props.roomId);
        this.roomStateEvents = room.currentState.events;

        this.onBack = this.onBack.bind(this);
    }

    state = {
        eventType: null,
        event: null,
    };

    browseEventType(eventType) {
        return () => {
            this.setState({ eventType });
        };
    }

    onViewSourceClick(event) {
        return () => {
            this.setState({ event: event.event });
        };
    }

    onBack() {
        if (this.state.event) {
            this.setState({ event: null });
        } else if (this.state.eventType) {
            this.setState({ eventType: null });
        } else {
            this.props.onBack();
        }
    }

    render() {
        if (this.state.event) {
            return <div className="mx_ViewSource">
                <div className="mx_Dialog_content">
                    <pre>{JSON.stringify(this.state.event, null, 2)}</pre>
                </div>
                <div className="mx_Dialog_buttons">
                    <button onClick={this.onBack}>{ _t('Back') }</button>
                </div>
            </div>;
        }

        const rows = [];

        if (this.state.eventType === null) {
            Object.keys(this.roomStateEvents).forEach((evType) => {
                const stateGroup = this.roomStateEvents[evType];
                const stateKeys = Object.keys(stateGroup);

                let onClickFn;
                if (stateKeys.length > 1) {
                    onClickFn = this.browseEventType(evType);
                } else if (stateKeys.length === 1) {
                    onClickFn = this.onViewSourceClick(stateGroup[stateKeys[0]]);
                }

                rows.push(<button className="mx_DevTools_RoomStateExplorer_button" key={evType} onClick={onClickFn}>
                    { evType }
                </button>);
            });
        } else {
            const evType = this.state.eventType;
            const stateGroup = this.roomStateEvents[evType];
            Object.keys(stateGroup).forEach((stateKey) => {
                const ev = stateGroup[stateKey];
                rows.push(<button className="mx_DevTools_RoomStateExplorer_button" key={stateKey}
                                  onClick={this.onViewSourceClick(ev)}>
                    { stateKey }
                </button>);
            });
        }

        return <div>
            <div className="mx_Dialog_content">
                {rows}
            </div>
            <div className="mx_Dialog_buttons">
                <button onClick={this.onBack}>{ _t('Back') }</button>
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
        this.onBack = this.onBack.bind(this);
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

    onBack() {
        this.setState({ mode: null });
    }

    onCancel() {
        this.props.onFinished(false);
    }

    render() {
        let body;

        if (this.state.mode) {
            body = <this.state.mode {...this.props} onBack={this.onBack} />;
        } else {
            body = <div>
                <div className="mx_Dialog_content">
                    <button onClick={this._setMode(SendCustomEvent)}>{ _t('Send Custom Event') }</button>
                    <button onClick={this._setMode(SendCustomStateEvent)}>{ _t('Send Custom State Event') }</button>
                    <button onClick={this._setMode(RoomStateExplorer)}>{ _t('Explore Room State') }</button>
                </div>
                <div className="mx_Dialog_buttons">
                    <button onClick={this.onCancel}>{ _t('Cancel') }</button>
                </div>
            </div>;
        }

        const BaseDialog = sdk.getComponent('views.dialogs.BaseDialog');
        return <BaseDialog className="mx_QuestionDialog" onFinished={this.props.onFinished} title={_t('Developer Tools')}>
            <div>Room ID: {this.props.roomId}</div>
            { body }
        </BaseDialog>;
    }
}
