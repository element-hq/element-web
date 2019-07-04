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
import PropTypes from 'prop-types';
import * as HtmlUtils from '../../../HtmlUtils';
import {formatTime} from '../../../DateUtils';
import {MatrixEvent} from 'matrix-js-sdk';
import {pillifyLinks} from '../../../utils/pillify';
import { _t } from '../../../languageHandler';
import sdk from '../../../index';
import MatrixClientPeg from '../../../MatrixClientPeg';
import Modal from '../../../Modal';
import classNames from 'classnames';

export default class EditHistoryMessage extends React.PureComponent {
    static propTypes = {
        // the message event being edited
        mxEvent: PropTypes.instanceOf(MatrixEvent).isRequired,
    };

    constructor(props) {
        super(props);
        const cli = MatrixClientPeg.get();
        const {userId} = cli.credentials;
        const event = this.props.mxEvent;
        const room = cli.getRoom(event.getRoomId());
        const canRedact = room.currentState.maySendRedactionForEvent(event, userId);
        this.state = {canRedact};
    }

    _onRedactClick = async () => {
        const event = this.props.mxEvent;
        const cli = MatrixClientPeg.get();
        const ConfirmAndWaitRedactDialog = sdk.getComponent("dialogs.ConfirmAndWaitRedactDialog");

        Modal.createTrackedDialog('Confirm Redact Dialog from edit history', '', ConfirmAndWaitRedactDialog, {
            redact: () => cli.redactEvent(event.getRoomId(), event.getId()),
        }, 'mx_Dialog_confirmredact');
    };

    pillifyLinks() {
        // not present for redacted events
        if (this.refs.content) {
            pillifyLinks(this.refs.content.children, this.props.mxEvent);
        }
    }

    componentDidMount() {
        this.pillifyLinks();
    }

    componentDidUpdate() {
        this.pillifyLinks();
    }

    _renderActionBar() {
        const AccessibleButton = sdk.getComponent('elements.AccessibleButton');
        if (this.props.mxEvent.isRedacted()) {
            return null;
        }
        return (<div className="mx_MessageActionBar">
            <AccessibleButton onClick={this._onRedactClick} disabled={!this.state.canRedact}>{_t("Remove")}</AccessibleButton>
        </div>);
    }

    render() {
        const {mxEvent} = this.props;
        const originalContent = mxEvent.getOriginalContent();
        const content = originalContent["m.new_content"] || originalContent;
        const contentElements = HtmlUtils.bodyToHtml(content);
        const isRedacted = this.props.mxEvent.isRedacted();
        let contentContainer;
        if (isRedacted) {
            const UnknownBody = sdk.getComponent('messages.UnknownBody');
            contentContainer = (<UnknownBody mxEvent={this.props.mxEvent} />);
        } else if (mxEvent.getContent().msgtype === "m.emote") {
            const name = mxEvent.sender ? mxEvent.sender.name : mxEvent.getSender();
            contentContainer = (<div className="mx_EventTile_content" ref="content">*&nbsp;
                <span className="mx_MEmoteBody_sender">{ name }</span>
                &nbsp;{contentElements}
            </div>);
        } else {
            contentContainer = (<div className="mx_EventTile_content" ref="content">{contentElements}</div>);
        }
        const timestamp = formatTime(new Date(mxEvent.getTs()), this.props.isTwelveHour);
        const sendStatus = mxEvent.getAssociatedStatus();
        const isSending = (['sending', 'queued', 'encrypting'].indexOf(sendStatus) !== -1);
        const classes = classNames({
            "mx_EventTile": true,
            "mx_EventTile_redacted": isRedacted,
            "mx_EventTile_sending": isSending,
            "mx_EventTile_notSent": sendStatus === 'not_sent',
        });
        return <li className={classes}>
            <div className="mx_EventTile_line">
                <span className="mx_MessageTimestamp">{timestamp}</span>
                { contentContainer }
                { this._renderActionBar() }
            </div>
        </li>;
    }
}
