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

import React, { createRef } from 'react';
import { EventStatus, MatrixEvent, MatrixEventEvent } from 'matrix-js-sdk/src/models/event';
import classNames from 'classnames';

import * as HtmlUtils from '../../../HtmlUtils';
import { editBodyDiffToHtml } from '../../../utils/MessageDiffUtils';
import { formatTime } from '../../../DateUtils';
import { pillifyLinks, unmountPills } from '../../../utils/pillify';
import { tooltipifyLinks, unmountTooltips } from '../../../utils/tooltipify';
import { _t } from '../../../languageHandler';
import { MatrixClientPeg } from '../../../MatrixClientPeg';
import Modal from '../../../Modal';
import RedactedBody from "./RedactedBody";
import AccessibleButton from "../elements/AccessibleButton";
import ConfirmAndWaitRedactDialog from "../dialogs/ConfirmAndWaitRedactDialog";
import ViewSource from "../../structures/ViewSource";
import SettingsStore from "../../../settings/SettingsStore";

function getReplacedContent(event) {
    const originalContent = event.getOriginalContent();
    return originalContent["m.new_content"] || originalContent;
}

interface IProps {
    // the message event being edited
    mxEvent: MatrixEvent;
    previousEdit?: MatrixEvent;
    isBaseEvent?: boolean;
    isTwelveHour?: boolean;
}

interface IState {
    canRedact: boolean;
    sendStatus: EventStatus;
}

export default class EditHistoryMessage extends React.PureComponent<IProps, IState> {
    private content = createRef<HTMLDivElement>();
    private pills: Element[] = [];
    private tooltips: Element[] = [];

    constructor(props: IProps) {
        super(props);

        const cli = MatrixClientPeg.get();
        const { userId } = cli.credentials;
        const event = this.props.mxEvent;
        const room = cli.getRoom(event.getRoomId());
        if (event.localRedactionEvent()) {
            event.localRedactionEvent().on(MatrixEventEvent.Status, this.onAssociatedStatusChanged);
        }
        const canRedact = room.currentState.maySendRedactionForEvent(event, userId);
        this.state = { canRedact, sendStatus: event.getAssociatedStatus() };
    }

    private onAssociatedStatusChanged = (): void => {
        this.setState({ sendStatus: this.props.mxEvent.getAssociatedStatus() });
    };

    private onRedactClick = async (): Promise<void> => {
        const event = this.props.mxEvent;
        const cli = MatrixClientPeg.get();

        Modal.createDialog(ConfirmAndWaitRedactDialog, {
            redact: () => cli.redactEvent(event.getRoomId(), event.getId()),
        }, 'mx_Dialog_confirmredact');
    };

    private onViewSourceClick = (): void => {
        Modal.createDialog(ViewSource, {
            mxEvent: this.props.mxEvent,
        }, 'mx_Dialog_viewsource');
    };

    private pillifyLinks(): void {
        // not present for redacted events
        if (this.content.current) {
            pillifyLinks(this.content.current.children, this.props.mxEvent, this.pills);
        }
    }

    private tooltipifyLinks(): void {
        // not present for redacted events
        if (this.content.current) {
            tooltipifyLinks(this.content.current.children, this.pills, this.tooltips);
        }
    }

    public componentDidMount(): void {
        this.pillifyLinks();
        this.tooltipifyLinks();
    }

    public componentWillUnmount(): void {
        unmountPills(this.pills);
        unmountTooltips(this.tooltips);
        const event = this.props.mxEvent;
        if (event.localRedactionEvent()) {
            event.localRedactionEvent().off(MatrixEventEvent.Status, this.onAssociatedStatusChanged);
        }
    }

    public componentDidUpdate(): void {
        this.pillifyLinks();
        this.tooltipifyLinks();
    }

    private renderActionBar(): JSX.Element {
        // hide the button when already redacted
        let redactButton: JSX.Element;
        if (!this.props.mxEvent.isRedacted() && !this.props.isBaseEvent && this.state.canRedact) {
            redactButton = (
                <AccessibleButton onClick={this.onRedactClick}>
                    { _t("Remove") }
                </AccessibleButton>
            );
        }

        let viewSourceButton: JSX.Element;
        if (SettingsStore.getValue("developerMode")) {
            viewSourceButton = (
                <AccessibleButton onClick={this.onViewSourceClick}>
                    { _t("View Source") }
                </AccessibleButton>
            );
        }

        // disabled remove button when not allowed
        return (
            <div className="mx_MessageActionBar">
                { redactButton }
                { viewSourceButton }
            </div>
        );
    }

    public render(): JSX.Element {
        const { mxEvent } = this.props;
        const content = getReplacedContent(mxEvent);
        let contentContainer;
        if (mxEvent.isRedacted()) {
            contentContainer = <RedactedBody mxEvent={this.props.mxEvent} />;
        } else {
            let contentElements;
            if (this.props.previousEdit) {
                contentElements = editBodyDiffToHtml(getReplacedContent(this.props.previousEdit), content);
            } else {
                contentElements = HtmlUtils.bodyToHtml(
                    content,
                    null,
                    { stripReplyFallback: true, returnString: false },
                );
            }
            if (mxEvent.getContent().msgtype === "m.emote") {
                const name = mxEvent.sender ? mxEvent.sender.name : mxEvent.getSender();
                contentContainer = (
                    <div className="mx_EventTile_content" ref={this.content}>*&nbsp;
                        <span className="mx_MEmoteBody_sender">{ name }</span>
                        &nbsp;{ contentElements }
                    </div>
                );
            } else {
                contentContainer = <div className="mx_EventTile_content" ref={this.content}>{ contentElements }</div>;
            }
        }

        const timestamp = formatTime(new Date(mxEvent.getTs()), this.props.isTwelveHour);
        const isSending = (['sending', 'queued', 'encrypting'].indexOf(this.state.sendStatus) !== -1);
        const classes = classNames({
            "mx_EventTile": true,
            // Note: we keep the `sending` state class for tests, not for our styles
            "mx_EventTile_sending": isSending,
        });
        return (
            <li>
                <div className={classes}>
                    <div className="mx_EventTile_line">
                        <span className="mx_MessageTimestamp">{ timestamp }</span>
                        { contentContainer }
                        { this.renderActionBar() }
                    </div>
                </div>
            </li>
        );
    }
}
