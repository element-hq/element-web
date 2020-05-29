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

import React, {createRef} from 'react';
import PropTypes from 'prop-types';
import * as HtmlUtils from '../../../HtmlUtils';
import { editBodyDiffToHtml } from '../../../utils/MessageDiffUtils';
import {formatTime} from '../../../DateUtils';
import {MatrixEvent} from 'matrix-js-sdk';
import {pillifyLinks, unmountPills} from '../../../utils/pillify';
import { _t } from '../../../languageHandler';
import * as sdk from '../../../index';
import {MatrixClientPeg} from '../../../MatrixClientPeg';
import Modal from '../../../Modal';
import classNames from 'classnames';
import RedactedBody from "./RedactedBody";

function getReplacedContent(event) {
    const originalContent = event.getOriginalContent();
    return originalContent["m.new_content"] || originalContent;
}

export default class EditHistoryMessage extends React.PureComponent {
    static propTypes = {
        // the message event being edited
        mxEvent: PropTypes.instanceOf(MatrixEvent).isRequired,
        previousEdit: PropTypes.instanceOf(MatrixEvent),
        isBaseEvent: PropTypes.bool,
    };

    constructor(props) {
        super(props);
        const cli = MatrixClientPeg.get();
        const {userId} = cli.credentials;
        const event = this.props.mxEvent;
        const room = cli.getRoom(event.getRoomId());
        if (event.localRedactionEvent()) {
            event.localRedactionEvent().on("status", this._onAssociatedStatusChanged);
        }
        const canRedact = room.currentState.maySendRedactionForEvent(event, userId);
        this.state = {canRedact, sendStatus: event.getAssociatedStatus()};

        this._content = createRef();
        this._pills = [];
    }

    _onAssociatedStatusChanged = () => {
        this.setState({sendStatus: this.props.mxEvent.getAssociatedStatus()});
    };

    _onRedactClick = async () => {
        const event = this.props.mxEvent;
        const cli = MatrixClientPeg.get();
        const ConfirmAndWaitRedactDialog = sdk.getComponent("dialogs.ConfirmAndWaitRedactDialog");

        Modal.createTrackedDialog('Confirm Redact Dialog', 'Edit history', ConfirmAndWaitRedactDialog, {
            redact: () => cli.redactEvent(event.getRoomId(), event.getId()),
        }, 'mx_Dialog_confirmredact');
    };

    _onViewSourceClick = () => {
        const ViewSource = sdk.getComponent('structures.ViewSource');
        Modal.createTrackedDialog('View Event Source', 'Edit history', ViewSource, {
            roomId: this.props.mxEvent.getRoomId(),
            eventId: this.props.mxEvent.getId(),
            content: this.props.mxEvent.event,
        }, 'mx_Dialog_viewsource');
    };

    pillifyLinks() {
        // not present for redacted events
        if (this._content.current) {
            pillifyLinks(this._content.current.children, this.props.mxEvent, this._pills);
        }
    }

    componentDidMount() {
        this.pillifyLinks();
    }

    componentWillUnmount() {
        unmountPills(this._pills);
        const event = this.props.mxEvent;
        if (event.localRedactionEvent()) {
            event.localRedactionEvent().off("status", this._onAssociatedStatusChanged);
        }
    }

    componentDidUpdate() {
        this.pillifyLinks();
    }

    _renderActionBar() {
        const AccessibleButton = sdk.getComponent('elements.AccessibleButton');
        // hide the button when already redacted
        let redactButton;
        if (!this.props.mxEvent.isRedacted() && !this.props.isBaseEvent && this.state.canRedact) {
            redactButton = (
                <AccessibleButton onClick={this._onRedactClick}>
                    {_t("Remove")}
                </AccessibleButton>
            );
        }
        const viewSourceButton = (
            <AccessibleButton onClick={this._onViewSourceClick}>
                {_t("View Source")}
            </AccessibleButton>
        );
        // disabled remove button when not allowed
        return (
            <div className="mx_MessageActionBar">
                {redactButton}
                {viewSourceButton}
            </div>
        );
    }

    render() {
        const {mxEvent} = this.props;
        const content = getReplacedContent(mxEvent);
        let contentContainer;
        if (mxEvent.isRedacted()) {
            contentContainer = <RedactedBody mxEvent={this.props.mxEvent} />;
        } else {
            let contentElements;
            if (this.props.previousEdit) {
                contentElements = editBodyDiffToHtml(getReplacedContent(this.props.previousEdit), content);
            } else {
                contentElements = HtmlUtils.bodyToHtml(content, null, {stripReplyFallback: true});
            }
            if (mxEvent.getContent().msgtype === "m.emote") {
                const name = mxEvent.sender ? mxEvent.sender.name : mxEvent.getSender();
                contentContainer = (
                    <div className="mx_EventTile_content" ref={this._content}>*&nbsp;
                        <span className="mx_MEmoteBody_sender">{ name }</span>
                        &nbsp;{contentElements}
                    </div>
                );
            } else {
                contentContainer = <div className="mx_EventTile_content" ref={this._content}>{contentElements}</div>;
            }
        }

        const timestamp = formatTime(new Date(mxEvent.getTs()), this.props.isTwelveHour);
        const isSending = (['sending', 'queued', 'encrypting'].indexOf(this.state.sendStatus) !== -1);
        const classes = classNames({
            "mx_EventTile": true,
            "mx_EventTile_sending": isSending,
            "mx_EventTile_notSent": this.state.sendStatus === 'not_sent',
        });
        return (
            <li>
                <div className={classes}>
                    <div className="mx_EventTile_line">
                        <span className="mx_MessageTimestamp">{timestamp}</span>
                        { contentContainer }
                        { this._renderActionBar() }
                    </div>
                </div>
            </li>
        );
    }
}
