/*
Copyright 2024 New Vector Ltd.
Copyright 2019 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { createRef } from "react";
import { type EventStatus, type IContent, type MatrixEvent, MatrixEventEvent, MsgType } from "matrix-js-sdk/src/matrix";
import classNames from "classnames";

import * as HtmlUtils from "../../../HtmlUtils";
import { editBodyDiffToHtml } from "../../../utils/MessageDiffUtils";
import { formatTime } from "../../../DateUtils";
import { pillifyLinks } from "../../../utils/pillify";
import { tooltipifyLinks } from "../../../utils/tooltipify";
import { _t } from "../../../languageHandler";
import Modal from "../../../Modal";
import RedactedBody from "./RedactedBody";
import AccessibleButton from "../elements/AccessibleButton";
import ConfirmAndWaitRedactDialog from "../dialogs/ConfirmAndWaitRedactDialog";
import ViewSource from "../../structures/ViewSource";
import SettingsStore from "../../../settings/SettingsStore";
import MatrixClientContext from "../../../contexts/MatrixClientContext";
import { ReactRootManager } from "../../../utils/react";

function getReplacedContent(event: MatrixEvent): IContent {
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
    sendStatus: EventStatus | null;
}

export default class EditHistoryMessage extends React.PureComponent<IProps, IState> {
    public static contextType = MatrixClientContext;
    declare public context: React.ContextType<typeof MatrixClientContext>;

    private content = createRef<HTMLDivElement>();
    private pills = new ReactRootManager();
    private tooltips = new ReactRootManager();

    public constructor(props: IProps, context: React.ContextType<typeof MatrixClientContext>) {
        super(props, context);

        const cli = this.context;
        const userId = cli.getSafeUserId();
        const event = this.props.mxEvent;
        const room = cli.getRoom(event.getRoomId());
        event.localRedactionEvent()?.on(MatrixEventEvent.Status, this.onAssociatedStatusChanged);
        const canRedact = room?.currentState.maySendRedactionForEvent(event, userId) ?? false;
        this.state = { canRedact, sendStatus: event.getAssociatedStatus() };
    }

    private onAssociatedStatusChanged = (): void => {
        this.setState({ sendStatus: this.props.mxEvent.getAssociatedStatus() });
    };

    private onRedactClick = async (): Promise<void> => {
        const event = this.props.mxEvent;
        const cli = this.context;

        Modal.createDialog(
            ConfirmAndWaitRedactDialog,
            {
                event,
                redact: async () => {
                    await cli.redactEvent(event.getRoomId()!, event.getId()!);
                },
            },
            "mx_Dialog_confirmredact",
        );
    };

    private onViewSourceClick = (): void => {
        Modal.createDialog(
            ViewSource,
            {
                mxEvent: this.props.mxEvent,
                ignoreEdits: true,
            },
            "mx_Dialog_viewsource",
        );
    };

    private pillifyLinks(): void {
        // not present for redacted events
        if (this.content.current) {
            pillifyLinks(this.context, this.content.current.children, this.props.mxEvent, this.pills);
        }
    }

    private tooltipifyLinks(): void {
        // not present for redacted events
        if (this.content.current) {
            tooltipifyLinks(this.content.current.children, this.pills.elements, this.tooltips);
        }
    }

    public componentDidMount(): void {
        this.pillifyLinks();
        this.tooltipifyLinks();
    }

    public componentWillUnmount(): void {
        this.pills.unmount();
        this.tooltips.unmount();
        const event = this.props.mxEvent;
        event.localRedactionEvent()?.off(MatrixEventEvent.Status, this.onAssociatedStatusChanged);
    }

    public componentDidUpdate(): void {
        this.pillifyLinks();
        this.tooltipifyLinks();
    }

    private renderActionBar(): React.ReactNode {
        // hide the button when already redacted
        let redactButton: JSX.Element | undefined;
        if (!this.props.mxEvent.isRedacted() && !this.props.isBaseEvent && this.state.canRedact) {
            redactButton = <AccessibleButton onClick={this.onRedactClick}>{_t("action|remove")}</AccessibleButton>;
        }

        let viewSourceButton: JSX.Element | undefined;
        if (SettingsStore.getValue("developerMode")) {
            viewSourceButton = (
                <AccessibleButton onClick={this.onViewSourceClick}>{_t("action|view_source")}</AccessibleButton>
            );
        }

        if (!redactButton && !viewSourceButton) {
            // Hide the empty MessageActionBar
            return null;
        } else {
            // disabled remove button when not allowed
            return (
                <div className="mx_MessageActionBar">
                    {redactButton}
                    {viewSourceButton}
                </div>
            );
        }
    }

    public render(): React.ReactNode {
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
                contentElements = HtmlUtils.bodyToSpan(content, null, {
                    stripReplyFallback: true,
                });
            }
            if (mxEvent.getContent().msgtype === MsgType.Emote) {
                const name = mxEvent.sender ? mxEvent.sender.name : mxEvent.getSender();
                contentContainer = (
                    <div className="mx_EventTile_content" ref={this.content}>
                        *&nbsp;
                        <span className="mx_MEmoteBody_sender">{name}</span>
                        &nbsp;{contentElements}
                    </div>
                );
            } else {
                contentContainer = (
                    <div className="mx_EventTile_content" ref={this.content}>
                        {contentElements}
                    </div>
                );
            }
        }

        const timestamp = formatTime(new Date(mxEvent.getTs()), this.props.isTwelveHour);
        const isSending = ["sending", "queued", "encrypting"].includes(this.state.sendStatus!);
        const classes = classNames("mx_EventTile", {
            // Note: we keep the `sending` state class for tests, not for our styles
            mx_EventTile_sending: isSending,
        });
        return (
            <li>
                <div className={classes}>
                    <div className="mx_EventTile_line">
                        <span className="mx_MessageTimestamp">{timestamp}</span>
                        {contentContainer}
                        {this.renderActionBar()}
                    </div>
                </div>
            </li>
        );
    }
}
