/*
Copyright 2016 OpenMarket Ltd

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

import {getAddressType, inviteToRoom} from '../../../Invite';
import sdk from '../../../index';

export default class MultiInviteDialog extends React.Component {
    constructor(props, context) {
        super(props, context);

        this._onCancel = this._onCancel.bind(this);
        this._startInviting = this._startInviting.bind(this);
        this._canceled = false;

        this.state = {
            busy: false,
            completionStates: {}, // State of each address (invited or error)
            errorTexts: {}, // Textual error per address
            done: false,
        };
        for (let i = 0; i < this.props.inputs.length; ++i) {
            const input = this.props.inputs[i];
            if (getAddressType(input) === null) {
                this.state.completionStates[i] = 'error';
                this.state.errorTexts[i] = 'Unrecognised address';
            }
        }
    }

    componentWillUnmount() {
        this._canceled = true;
    }

    _onCancel() {
        this._canceled = true;
        this.props.onFinished(false);
    }

    _startInviting() {
        this.setState({
            busy: true,
            done: false,
        });
        this._inviteMore(0);
    }

    _inviteMore(nextIndex) {
        if (this._canceled) {
            return;
        }

        if (nextIndex == this.props.inputs.length) {
            this.setState({
                busy: false,
                done: true,
            });
            return;
        }

        const input = this.props.inputs[nextIndex];

        // don't try to invite it if it's an invalid address
        // (it will already be marked as an error though,
        // so no need to do so again)
        if (getAddressType(input) === null) {
            this._inviteMore(nextIndex + 1);
            return;
        }

        // don't re-invite (there's no way in the UI to do this, but
        // for sanity's sake)
        if (this.state.completionStates[nextIndex] == 'invited') {
            this._inviteMore(nextIndex + 1);
            return;
        }

        inviteToRoom(this.props.roomId, input).then(() => {
            if (this._canceled) { return; }

            this.setState((s) => {
                s.completionStates[nextIndex] = 'invited'
                return s;
            });
            this._inviteMore(nextIndex + 1);
        }, (err) => {
            if (this._canceled) { return; }

            let errorText;
            let fatal = false;
            if (err.errcode == 'M_FORBIDDEN') {
                fatal = true;
                errorText = 'You do not have permission to invite people to this room.';
            } else if (err.errcode == 'M_LIMIT_EXCEEDED') {
                // we're being throttled so wait a bit & try again
                setTimeout(() => {
                    this._inviteMore(nextIndex);
                }, 5000);
                return;
            } else {
                errorText = 'Unknown server error';
            }
            this.setState((s) => {
                s.completionStates[nextIndex] = 'error';
                s.errorTexts[nextIndex] = errorText;
                s.busy = !fatal;
                s.done = fatal;
                return s;
            });
            if (!fatal) {
                this._inviteMore(nextIndex + 1);
            }
        });
    }

    _getProgressIndicator() {
        let numErrors = 0;
        for (const k of Object.keys(this.state.completionStates)) {
            if (this.state.completionStates[k] == 'error') {
                ++numErrors;
            }
        }
        let errorText;
        if (numErrors > 0) {
            const plural = numErrors > 1 ? 's' : '';
            errorText = <span className="error">({numErrors} error{plural})</span>
        }
        return <span>
            {Object.keys(this.state.completionStates).length} / {this.props.inputs.length} {errorText}
        </span>;
    }

    render() {
        const Spinner = sdk.getComponent("elements.Spinner");
        const inviteTiles = [];

        for (let i = 0; i < this.props.inputs.length; ++i) {
            const input = this.props.inputs[i];
            let statusClass = '';
            let statusElement;
            if (this.state.completionStates[i] == 'error') {
                statusClass = 'error';
                statusElement = <p className="mx_MultiInviteDialog_statusText">{this.state.errorTexts[i]}</p>;
            } else if (this.state.completionStates[i] == 'invited') {
                statusClass = 'invited';
            }
            inviteTiles.push(
                <li key={i}>
                    <p className={statusClass}>{input}</p>
                    {statusElement}
                </li>
            );
        }

        let controls = [];
        if (this.state.busy) {
            controls.push(<Spinner key="spinner" />);
            controls.push(<button key="cancel" onClick={this._onCancel}>Cancel</button>);
            controls.push(<span key="progr">{this._getProgressIndicator()}</span>);
        } else if (this.state.done) {
            controls.push(
                <button
                    key="cancel"
                    className="mx_Dialog_primary"
                    onClick={this._onCancel}
                >Done</button>
            );
            controls.push(<span key="progr">{this._getProgressIndicator()}</span>);
        } else {
            controls.push(
                <button
                    key="invite"
                    onClick={this._startInviting}
                    autoFocus={true}
                    className="mx_Dialog_primary"
                >
                Invite
            </button>);
            controls.push(<button key="cancel" onClick={this._onCancel}>Cancel</button>);
        }

        return (
            <div className="mx_MultiInviteDialog">
                <div className="mx_Dialog_title">
                    Inviting {this.props.inputs.length} People
                </div>
                <div className="mx_Dialog_content">
                    <ul>
                        {inviteTiles}
                    </ul>
                </div>
                <div className="mx_Dialog_buttons">
                    {controls}
                </div>
            </div>
        );
    }
}

MultiInviteDialog.propTypes = {
    onFinished: React.PropTypes.func.isRequired,
    inputs: React.PropTypes.array.isRequired,
    roomId: React.PropTypes.string.isRequired,
};
