/*
Copyright 2024 New Vector Ltd.
Copyright 2019 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { createRef } from "react";
import { type EventStatus, type IContent, type MatrixEvent, MatrixEventEvent, MsgType } from "matrix-js-sdk/src/matrix";
import classNames from "classnames";
import { ActionBarView, EventContentBodyView } from "@element-hq/web-shared-components";

import { EditHistoryActionBarViewModel } from "../../../viewmodels/message-body/EditHistoryActionBarViewModel";
import { EventContentBodyViewModel } from "../../../viewmodels/message-body/EventContentBodyViewModel";
import { editBodyDiffToHtml } from "../../../utils/MessageDiffUtils";
import { formatTime } from "../../../DateUtils";
import Modal from "../../../Modal";
import ConfirmAndWaitRedactDialog from "../dialogs/ConfirmAndWaitRedactDialog";
import ViewSource from "../../structures/ViewSource";
import SettingsStore from "../../../settings/SettingsStore";
import MatrixClientContext from "../../../contexts/MatrixClientContext";
import { RedactedBodyFactory } from "./MBodyFactory";

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
    private EventContentBodyViewModel: EventContentBodyViewModel;
    private editHistoryActionBarViewModel: EditHistoryActionBarViewModel;

    public constructor(props: IProps, context: React.ContextType<typeof MatrixClientContext>) {
        super(props, context);

        const cli = this.context;
        const userId = cli.getSafeUserId();
        const event = props.mxEvent;
        const room = cli.getRoom(event.getRoomId());
        event.localRedactionEvent()?.on(MatrixEventEvent.Status, this.onAssociatedStatusChanged);
        const canRedact = room?.currentState.maySendRedactionForEvent(event, userId) ?? false;
        this.state = { canRedact, sendStatus: event.getAssociatedStatus() };

        const mxEventContent = getReplacedContent(event);
        this.EventContentBodyViewModel = new EventContentBodyViewModel({
            mxEvent: event,
            content: mxEventContent,
            highlights: [],
            stripReply: true,
            renderTooltipsForAmbiguousLinks: true,
            renderMentionPills: true,
            renderCodeBlocks: true,
            renderSpoilers: true,
            linkify: true,
            client: cli,
        });

        this.editHistoryActionBarViewModel = new EditHistoryActionBarViewModel({
            canRemove: !props.mxEvent.isRedacted() && !props.isBaseEvent && canRedact,
            showViewSource: SettingsStore.getValue("developerMode"),
            onRemoveClick: this.onRedactClick,
            onViewSourceClick: this.onViewSourceClick,
        });
    }

    public componentDidUpdate(prevProps: IProps): void {
        if (prevProps.mxEvent !== this.props.mxEvent) {
            const mxEventContent = getReplacedContent(this.props.mxEvent);
            this.EventContentBodyViewModel.setEventContent(this.props.mxEvent, mxEventContent);
        }

        this.editHistoryActionBarViewModel.setProps({
            canRemove: !this.props.mxEvent.isRedacted() && !this.props.isBaseEvent && this.state.canRedact,
            showViewSource: SettingsStore.getValue("developerMode"),
            onRemoveClick: this.onRedactClick,
            onViewSourceClick: this.onViewSourceClick,
        });
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

    public componentWillUnmount(): void {
        const event = this.props.mxEvent;
        event.localRedactionEvent()?.off(MatrixEventEvent.Status, this.onAssociatedStatusChanged);
        this.EventContentBodyViewModel.dispose();
        this.editHistoryActionBarViewModel.dispose();
    }

    private renderActionBar(): React.ReactNode {
        this.editHistoryActionBarViewModel.setProps({
            canRemove: !this.props.mxEvent.isRedacted() && !this.props.isBaseEvent && this.state.canRedact,
            showViewSource: SettingsStore.getValue("developerMode"),
            onRemoveClick: this.onRedactClick,
            onViewSourceClick: this.onViewSourceClick,
        });

        return (
            <ActionBarView vm={this.editHistoryActionBarViewModel} className="mx_ThreadActionBar mx_HistoryActionBar" />
        );
    }

    public render(): React.ReactNode {
        const { mxEvent } = this.props;
        const content = getReplacedContent(mxEvent);
        let contentContainer;
        if (mxEvent.isRedacted()) {
            contentContainer = <RedactedBodyFactory mxEvent={this.props.mxEvent} />;
        } else {
            let contentElements;
            if (this.props.previousEdit) {
                contentElements = editBodyDiffToHtml(getReplacedContent(this.props.previousEdit), content);
            } else {
                contentElements = <EventContentBodyView vm={this.EventContentBodyViewModel} as="span" />;
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
