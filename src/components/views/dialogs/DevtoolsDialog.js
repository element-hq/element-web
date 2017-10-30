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
import PropTypes from 'prop-types';
import sdk from 'matrix-react-sdk';
import { _t } from 'matrix-react-sdk/lib/languageHandler';
import MatrixClientPeg from 'matrix-react-sdk/lib/MatrixClientPeg';

class DevtoolsComponent extends React.Component {
    static contextTypes = {
        roomId: PropTypes.string.isRequired,
    };
}

class GenericEditor extends DevtoolsComponent {
    // static propTypes = {onBack: PropTypes.func.isRequired};

    constructor(props, context) {
        super(props, context);
        this._onChange = this._onChange.bind(this);
        this.onBack = this.onBack.bind(this);
    }

    onBack() {
        if (this.state.message) {
            this.setState({ message: null });
        } else {
            this.props.onBack();
        }
    }

    _onChange(e) {
        this.setState({[e.target.id]: e.target.type === 'checkbox' ? e.target.checked : e.target.value});
    }

    _buttons() {
        return <div className="mx_Dialog_buttons">
            <button onClick={this.onBack}>{ _t('Back') }</button>
            { !this.state.message && <button onClick={this._send}>{ _t('Send') }</button> }
        </div>;
    }

    textInput(id, label) {
        return <div className="mx_UserSettings_profileTableRow">
            <div className="mx_UserSettings_profileLabelCell">
                <label htmlFor="displayName">{ label }</label>
            </div>
            <div className="mx_UserSettings_profileInputCell">
                <input id={id} onChange={this._onChange} value={this.state[id]} className="mx_EditableText" size="32" />
            </div>
        </div>;
    }
}

class SendCustomEvent extends GenericEditor {
    static getLabel() { return _t('Send Custom Event'); }

    static propTypes = {
        onBack: PropTypes.func.isRequired,
        forceStateEvent: PropTypes.bool,
        inputs: PropTypes.object,
    };

    constructor(props, context) {
        super(props, context);
        this._send = this._send.bind(this);

        const {eventType, stateKey, evContent} = Object.assign({
            eventType: '',
            stateKey: '',
            evContent: '{\n\n}',
        }, this.props.inputs);

        this.state = {
            isStateEvent: Boolean(this.props.forceStateEvent),

            eventType,
            stateKey,
            evContent,
        };
    }

    send(content) {
        const cli = MatrixClientPeg.get();
        if (this.state.isStateEvent) {
            return cli.sendStateEvent(this.context.roomId, this.state.eventType, content, this.state.stateKey);
        } else {
            return cli.sendEvent(this.context.roomId, this.state.eventType, content);
        }
    }

    async _send() {
        if (this.state.eventType === '') {
            this.setState({ message: _t('You must specify an event type!') });
            return;
        }

        let message;
        try {
            const content = JSON.parse(this.state.evContent);
            await this.send(content);
            message = _t('Event sent!');
        } catch (e) {
            message = _t('Failed to send custom event.') + ' (' + e.toString() + ')';
        }
        this.setState({ message });
    }

    render() {
        if (this.state.message) {
            return <div>
                <div className="mx_Dialog_content">
                    { this.state.message }
                </div>
                { this._buttons() }
            </div>;
        }

        return <div>
            <div className="mx_Dialog_content">
                { this.textInput('eventType', _t('Event Type')) }
                { this.state.isStateEvent && this.textInput('stateKey', _t('State Key')) }

                <br />

                <div className="mx_UserSettings_profileLabelCell">
                    <label htmlFor="evContent"> { _t('Event Content') } </label>
                </div>
                <div>
                    <textarea id="evContent" onChange={this._onChange} value={this.state.evContent} className="mx_TextInputDialog_input" cols="63" rows="5" />
                </div>
            </div>
            <div className="mx_Dialog_buttons">
                <button onClick={this.onBack}>{ _t('Back') }</button>
                { !this.state.message && <button onClick={this._send}>{ _t('Send') }</button> }
                { !this.state.message && !this.props.forceStateEvent && <div style={{float: "right"}}>
                    <input id="isStateEvent" className="tgl tgl-flip" type="checkbox" onChange={this._onChange} checked={this.state.isStateEvent} />
                    <label className="tgl-btn" data-tg-off="Event" data-tg-on="State Event" htmlFor="isStateEvent" />
                </div> }
            </div>
        </div>;
    }
}

class SendAccountData extends GenericEditor {
    static getLabel() { return _t('Send Account Data'); }

    static propTypes = {
        isRoomAccountData: PropTypes.bool,
        forceMode: PropTypes.bool,
        inputs: PropTypes.object,
    };

    constructor(props, context) {
        super(props, context);
        this._send = this._send.bind(this);

        const {eventType, evContent} = Object.assign({
            eventType: '',
            evContent: '{\n\n}',
        }, this.props.inputs);

        this.state = {
            isRoomAccountData: Boolean(this.props.isRoomAccountData),

            eventType,
            evContent,
        };
    }

    send(content) {
        const cli = MatrixClientPeg.get();
        if (this.state.isRoomAccountData) {
            return cli.setRoomAccountData(this.context.roomId, this.state.eventType, content);
        }
        return cli.setAccountData(this.state.eventType, content);
    }

    async _send() {
        if (this.state.eventType === '') {
            this.setState({ message: _t('You must specify an event type!') });
            return;
        }

        let message;
        try {
            const content = JSON.parse(this.state.evContent);
            await this.send(content);
            message = _t('Event sent!');
        } catch (e) {
            message = _t('Failed to send custom event.') + ' (' + e.toString() + ')';
        }
        this.setState({ message });
    }

    render() {
        if (this.state.message) {
            return <div>
                <div className="mx_Dialog_content">
                    { this.state.message }
                </div>
                { this._buttons() }
            </div>;
        }

        return <div>
            <div className="mx_Dialog_content">
                { this.textInput('eventType', _t('Event Type')) }
                <br />

                <div className="mx_UserSettings_profileLabelCell">
                    <label htmlFor="evContent"> { _t('Event Content') } </label>
                </div>
                <div>
                    <textarea id="evContent" onChange={this._onChange} value={this.state.evContent} className="mx_TextInputDialog_input" cols="63" rows="5" />
                </div>
            </div>
            <div className="mx_Dialog_buttons">
                <button onClick={this.onBack}>{ _t('Back') }</button>
                { !this.state.message && <button onClick={this._send}>{ _t('Send') }</button> }
                { !this.state.message && <div style={{float: "right"}}>
                    <input id="isRoomAccountData" className="tgl tgl-flip" type="checkbox" onChange={this._onChange} checked={this.state.isRoomAccountData} disabled={this.props.forceMode} />
                    <label className="tgl-btn" data-tg-off="Account Data" data-tg-on="Room Data" htmlFor="isRoomAccountData" />
                </div> }
            </div>
        </div>;
    }
}

class FilteredList extends React.Component {
    static propTypes = {
        children: PropTypes.any,
    };

    constructor(props, context) {
        super(props, context);
        this.onQuery = this.onQuery.bind(this);

        this.state = {
            query: '',
        };
    }

    onQuery(ev) {
        this.setState({ query: ev.target.value });
    }

    filterChildren() {
        if (this.state.query) {
            const lowerQuery = this.state.query.toLowerCase();
            return this.props.children.filter((child) => child.key.toLowerCase().includes(lowerQuery));
        }
        return this.props.children;
    }

    render() {
        return <div>
            <input size="64"
                   onChange={this.onQuery}
                   value={this.state.query}
                   placeholder={_t('Filter results')}
                   className="mx_TextInputDialog_input mx_DevTools_RoomStateExplorer_query" />
            { this.filterChildren() }
        </div>;
    }
}

class RoomStateExplorer extends DevtoolsComponent {
    static getLabel() { return _t('Explore Room State'); }


    static propTypes = {
        onBack: PropTypes.func.isRequired,
    };

    constructor(props, context) {
        super(props, context);

        const room = MatrixClientPeg.get().getRoom(this.context.roomId);
        this.roomStateEvents = room.currentState.events;

        this.onBack = this.onBack.bind(this);
        this.editEv = this.editEv.bind(this);

        this.state = {
            eventType: null,
            event: null,
            editing: false,
        };
    }

    browseEventType(eventType) {
        return () => {
            this.setState({ eventType });
        };
    }

    onViewSourceClick(event) {
        return () => {
            this.setState({ event });
        };
    }

    onBack() {
        if (this.state.editing) {
            this.setState({ editing: false });
        } else if (this.state.event) {
            this.setState({ event: null });
        } else if (this.state.eventType) {
            this.setState({ eventType: null });
        } else {
            this.props.onBack();
        }
    }

    editEv() {
        this.setState({ editing: true });
    }

    render() {
        if (this.state.event) {
            if (this.state.editing) {
                return <SendCustomEvent forceStateEvent={true} onBack={this.onBack} inputs={{
                    eventType: this.state.event.getType(),
                    evContent: JSON.stringify(this.state.event.getContent(), null, '\t'),
                    stateKey: this.state.event.getStateKey(),
                }} />;
            }

            return <div className="mx_ViewSource">
                <div className="mx_Dialog_content">
                    <pre>{ JSON.stringify(this.state.event.event, null, 2) }</pre>
                </div>
                <div className="mx_Dialog_buttons">
                    <button onClick={this.onBack}>{ _t('Back') }</button>
                    <button onClick={this.editEv}>{ _t('Edit') }</button>
                </div>
            </div>;
        }

        const rows = [];

        const classes = 'mx_DevTools_RoomStateExplorer_button';
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

                rows.push(<button className={classes} key={evType} onClick={onClickFn}>
                    { evType }
                </button>);
            });
        } else {
            const evType = this.state.eventType;
            const stateGroup = this.roomStateEvents[evType];
            Object.keys(stateGroup).forEach((stateKey) => {
                const ev = stateGroup[stateKey];
                rows.push(<button className={classes} key={stateKey} onClick={this.onViewSourceClick(ev)}>
                    { stateKey }
                </button>);
            });
        }

        return <div>
            <div className="mx_Dialog_content">
                <FilteredList>
                    { rows }
                </FilteredList>
            </div>
            <div className="mx_Dialog_buttons">
                <button onClick={this.onBack}>{ _t('Back') }</button>
            </div>
        </div>;
    }
}

class AccountDataExplorer extends DevtoolsComponent {
    static getLabel() { return _t('Explore Account Data'); }

    static propTypes = {
        onBack: PropTypes.func.isRequired,
    };

    constructor(props, context) {
        super(props, context);

        this.onBack = this.onBack.bind(this);
        this.editEv = this.editEv.bind(this);
        this._onChange = this._onChange.bind(this);

        this.state = {
            isRoomAccountData: false,
            event: null,
            editing: false,
        };
    }

    getData() {
        const cli = MatrixClientPeg.get();
        if (this.state.isRoomAccountData) {
            return cli.getRoom(this.context.roomId).accountData;
        }
        return cli.store.accountData;
    }

    onViewSourceClick(event) {
        return () => {
            this.setState({ event });
        };
    }

    onBack() {
        if (this.state.editing) {
            this.setState({ editing: false });
        } else if (this.state.event) {
            this.setState({ event: null });
        } else {
            this.props.onBack();
        }
    }

    _onChange(e) {
        this.setState({[e.target.id]: e.target.type === 'checkbox' ? e.target.checked : e.target.value});
    }

    editEv() {
        this.setState({ editing: true });
    }

    render() {
        if (this.state.event) {
            if (this.state.editing) {
                return <SendAccountData isRoomAccountData={this.state.isRoomAccountData} onBack={this.onBack} inputs={{
                    eventType: this.state.event.getType(),
                    evContent: JSON.stringify(this.state.event.getContent(), null, '\t'),
                }} forceMode={true} />;
            }

            return <div className="mx_ViewSource">
                <div className="mx_Dialog_content">
                    <pre>{ JSON.stringify(this.state.event.event, null, 2) }</pre>
                </div>
                <div className="mx_Dialog_buttons">
                    <button onClick={this.onBack}>{ _t('Back') }</button>
                    <button onClick={this.editEv}>{ _t('Edit') }</button>
                </div>
            </div>;
        }

        const rows = [];

        const classes = 'mx_DevTools_RoomStateExplorer_button';

        const data = this.getData();
        Object.keys(data).forEach((evType) => {
            const ev = data[evType];
            rows.push(<button className={classes} key={evType} onClick={this.onViewSourceClick(ev)}>
                { evType }
            </button>);
        });

        return <div>
            <div className="mx_Dialog_content">
                <FilteredList>
                    { rows }
                </FilteredList>
            </div>
            <div className="mx_Dialog_buttons">
                <button onClick={this.onBack}>{ _t('Back') }</button>
                { !this.state.message && <div style={{float: "right"}}>
                    <input id="isRoomAccountData" className="tgl tgl-flip" type="checkbox" onChange={this._onChange} checked={this.state.isRoomAccountData} />
                    <label className="tgl-btn" data-tg-off="Account Data" data-tg-on="Room Data" htmlFor="isRoomAccountData" />
                </div> }
            </div>
        </div>;
    }
}

const Entries = [
    SendCustomEvent,
    RoomStateExplorer,
    SendAccountData,
    AccountDataExplorer,
];

export default class DevtoolsDialog extends React.Component {
    static childContextTypes = {
        roomId: PropTypes.string.isRequired,
        // client: PropTypes.instanceOf(MatixClient),
    };

    static propTypes = {
        roomId: PropTypes.string.isRequired,
        onFinished: PropTypes.func.isRequired,
    };

    constructor(props, context) {
        super(props, context);
        this.onBack = this.onBack.bind(this);
        this.onCancel = this.onCancel.bind(this);

        this.state = {
            mode: null,
        };
    }

    componentWillUnmount() {
        this._unmounted = true;
    }

    getChildContext() {
        return { roomId: this.props.roomId };
    }

    _setMode(mode) {
        return () => {
            this.setState({ mode });
        };
    }

    onBack() {
        if (this.prevMode) {
            this.setState({ mode: this.prevMode });
            this.prevMode = null;
        } else {
            this.setState({ mode: null });
        }
    }

    onCancel() {
        this.props.onFinished(false);
    }

    render() {
        let body;

        if (this.state.mode) {
            body = <div>
                <div style={{float: 'left'}}>{ this.state.mode.getLabel() }</div>
                <div style={{float: 'right'}}>Room ID: { this.props.roomId }</div>
                <div style={{clear: 'both'}} />
                <this.state.mode onBack={this.onBack} />
            </div>;
        } else {
            body = <div>
                <div className="mx_Dialog_content">
                    <div>Room ID: { this.props.roomId }</div>
                    { Entries.map((Entry) => {
                        const label = Entry.getLabel();
                        return <button key={label} onClick={this._setMode(Entry)}>{ _t(label) }</button>;
                    }) }
                </div>
                <div className="mx_Dialog_buttons">
                    <button onClick={this.onCancel}>{ _t('Cancel') }</button>
                </div>
            </div>;
        }

        const BaseDialog = sdk.getComponent('views.dialogs.BaseDialog');
        return (
            <BaseDialog className="mx_QuestionDialog" onFinished={this.props.onFinished} title={_t('Developer Tools')}>
                { body }
            </BaseDialog>
        );
    }
}
