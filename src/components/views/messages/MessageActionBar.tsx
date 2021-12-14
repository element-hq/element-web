/*
Copyright 2019 New Vector Ltd
Copyright 2019 Michael Telatynski <7t3chguy@gmail.com>
Copyright 2019, 2020 The Matrix.org Foundation C.I.C.

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

import React, { ReactElement, useEffect } from 'react';
import { EventStatus, MatrixEvent } from 'matrix-js-sdk/src/models/event';
import classNames from 'classnames';
import { MsgType } from 'matrix-js-sdk/src/@types/event';

import type { Relations } from 'matrix-js-sdk/src/models/relations';
import { _t } from '../../../languageHandler';
import dis from '../../../dispatcher/dispatcher';
import { Action } from '../../../dispatcher/actions';
import ContextMenu, { aboveLeftOf, ContextMenuTooltipButton, useContextMenu } from '../../structures/ContextMenu';
import { isContentActionable, canEditContent } from '../../../utils/EventUtils';
import RoomContext, { TimelineRenderingType } from "../../../contexts/RoomContext";
import Toolbar from "../../../accessibility/Toolbar";
import { RovingAccessibleTooltipButton, useRovingTabIndex } from "../../../accessibility/RovingTabIndex";
import { replaceableComponent } from "../../../utils/replaceableComponent";
import MessageContextMenu, { canCancel } from "../context_menus/MessageContextMenu";
import Resend from "../../../Resend";
import { MatrixClientPeg } from "../../../MatrixClientPeg";
import { MediaEventHelper } from "../../../utils/MediaEventHelper";
import DownloadActionButton from "./DownloadActionButton";
import SettingsStore from '../../../settings/SettingsStore';
import { RoomPermalinkCreator } from '../../../utils/permalinks/Permalinks';
import ReplyChain from '../elements/ReplyChain';
import { dispatchShowThreadEvent } from '../../../dispatcher/dispatch-actions/threads';
import ReactionPicker from "../emojipicker/ReactionPicker";

interface IOptionsButtonProps {
    mxEvent: MatrixEvent;
    // TODO: Types
    getTile: () => any | null;
    getReplyChain: () => ReplyChain;
    permalinkCreator: RoomPermalinkCreator;
    onFocusChange: (menuDisplayed: boolean) => void;
    getRelationsForEvent?: (
        eventId: string,
        relationType: string,
        eventType: string
    ) => Relations;
}

const OptionsButton: React.FC<IOptionsButtonProps> = ({
    mxEvent,
    getTile,
    getReplyChain,
    permalinkCreator,
    onFocusChange,
    getRelationsForEvent,
}) => {
    const [menuDisplayed, button, openMenu, closeMenu] = useContextMenu();
    const [onFocus, isActive, ref] = useRovingTabIndex(button);
    useEffect(() => {
        onFocusChange(menuDisplayed);
    }, [onFocusChange, menuDisplayed]);

    let contextMenu: ReactElement | null;
    if (menuDisplayed) {
        const tile = getTile && getTile();
        const replyChain = getReplyChain && getReplyChain();

        const buttonRect = button.current.getBoundingClientRect();
        contextMenu = <MessageContextMenu
            {...aboveLeftOf(buttonRect)}
            mxEvent={mxEvent}
            permalinkCreator={permalinkCreator}
            eventTileOps={tile && tile.getEventTileOps ? tile.getEventTileOps() : undefined}
            collapseReplyChain={replyChain && replyChain.canCollapse() ? replyChain.collapse : undefined}
            onFinished={closeMenu}
            getRelationsForEvent={getRelationsForEvent}
        />;
    }

    return <React.Fragment>
        <ContextMenuTooltipButton
            className="mx_MessageActionBar_maskButton mx_MessageActionBar_optionsButton"
            title={_t("Options")}
            onClick={() => {
                openMenu();
                // when the context menu is opened directly, e.g. via mouse click, the onFocus handler which tracks
                // the element that is currently focused is skipped. So we want to call onFocus manually to keep the
                // position in the page even when someone is clicking around.
                onFocus();
            }}
            isExpanded={menuDisplayed}
            inputRef={ref}
            onFocus={onFocus}
            tabIndex={isActive ? 0 : -1}
        />

        { contextMenu }
    </React.Fragment>;
};

interface IReactButtonProps {
    mxEvent: MatrixEvent;
    reactions: Relations;
    onFocusChange: (menuDisplayed: boolean) => void;
}

const ReactButton: React.FC<IReactButtonProps> = ({ mxEvent, reactions, onFocusChange }) => {
    const [menuDisplayed, button, openMenu, closeMenu] = useContextMenu();
    const [onFocus, isActive, ref] = useRovingTabIndex(button);
    useEffect(() => {
        onFocusChange(menuDisplayed);
    }, [onFocusChange, menuDisplayed]);

    let contextMenu;
    if (menuDisplayed) {
        const buttonRect = button.current.getBoundingClientRect();
        contextMenu = <ContextMenu {...aboveLeftOf(buttonRect)} onFinished={closeMenu} managed={false}>
            <ReactionPicker mxEvent={mxEvent} reactions={reactions} onFinished={closeMenu} />
        </ContextMenu>;
    }

    return <React.Fragment>
        <ContextMenuTooltipButton
            className="mx_MessageActionBar_maskButton mx_MessageActionBar_reactButton"
            title={_t("React")}
            onClick={() => {
                openMenu();
                // when the context menu is opened directly, e.g. via mouse click, the onFocus handler which tracks
                // the element that is currently focused is skipped. So we want to call onFocus manually to keep the
                // position in the page even when someone is clicking around.
                onFocus();
            }}
            isExpanded={menuDisplayed}
            inputRef={ref}
            onFocus={onFocus}
            tabIndex={isActive ? 0 : -1}
        />

        { contextMenu }
    </React.Fragment>;
};

interface IMessageActionBarProps {
    mxEvent: MatrixEvent;
    reactions?: Relations;
    // TODO: Types
    getTile: () => any | null;
    getReplyChain: () => ReplyChain | undefined;
    permalinkCreator?: RoomPermalinkCreator;
    onFocusChange?: (menuDisplayed: boolean) => void;
    toggleThreadExpanded: () => void;
    isQuoteExpanded?: boolean;
    getRelationsForEvent?: (
        eventId: string,
        relationType: string,
        eventType: string
    ) => Relations;
}

@replaceableComponent("views.messages.MessageActionBar")
export default class MessageActionBar extends React.PureComponent<IMessageActionBarProps> {
    public static contextType = RoomContext;

    public componentDidMount(): void {
        if (this.props.mxEvent.status && this.props.mxEvent.status !== EventStatus.SENT) {
            this.props.mxEvent.on("Event.status", this.onSent);
        }

        const client = MatrixClientPeg.get();
        client.decryptEventIfNeeded(this.props.mxEvent);

        if (this.props.mxEvent.isBeingDecrypted()) {
            this.props.mxEvent.once("Event.decrypted", this.onDecrypted);
        }
        this.props.mxEvent.on("Event.beforeRedaction", this.onBeforeRedaction);
    }

    public componentWillUnmount(): void {
        this.props.mxEvent.off("Event.status", this.onSent);
        this.props.mxEvent.off("Event.decrypted", this.onDecrypted);
        this.props.mxEvent.off("Event.beforeRedaction", this.onBeforeRedaction);
    }

    private onDecrypted = (): void => {
        // When an event decrypts, it is likely to change the set of available
        // actions, so we force an update to check again.
        this.forceUpdate();
    };

    private onBeforeRedaction = (): void => {
        // When an event is redacted, we can't edit it so update the available actions.
        this.forceUpdate();
    };

    private onSent = (): void => {
        // When an event is sent and echoed the possible actions change.
        this.forceUpdate();
    };

    private onFocusChange = (focused: boolean): void => {
        this.props.onFocusChange?.(focused);
    };

    private onReplyClick = (ev: React.MouseEvent): void => {
        dis.dispatch({
            action: 'reply_to_event',
            event: this.props.mxEvent,
            context: this.context.timelineRenderingType,
        });
    };

    private onThreadClick = (): void => {
        dispatchShowThreadEvent(this.props.mxEvent);
        dis.dispatch({
            action: Action.FocusSendMessageComposer,
            context: TimelineRenderingType.Thread,
        });
    };

    private onEditClick = (ev: React.MouseEvent): void => {
        dis.dispatch({
            action: Action.EditEvent,
            event: this.props.mxEvent,
            timelineRenderingType: this.context.timelineRenderingType,
        });
    };

    private readonly forbiddenThreadHeadMsgType = [
        MsgType.KeyVerificationRequest,
    ];

    private get showReplyInThreadAction(): boolean {
        const isThreadEnabled = SettingsStore.getValue("feature_thread");
        const inNotThreadTimeline = this.context.timelineRenderingType !== TimelineRenderingType.Thread;

        const isAllowedMessageType = !this.forbiddenThreadHeadMsgType.includes(
            this.props.mxEvent.getContent().msgtype as MsgType,
        );

        return isThreadEnabled && inNotThreadTimeline && isAllowedMessageType;
    }

    /**
     * Runs a given fn on the set of possible events to test. The first event
     * that passes the checkFn will have fn executed on it. Both functions take
     * a MatrixEvent object. If no particular conditions are needed, checkFn can
     * be null/undefined. If no functions pass the checkFn, no action will be
     * taken.
     * @param {Function} fn The execution function.
     * @param {Function} checkFn The test function.
     */
    private runActionOnFailedEv(fn: (ev: MatrixEvent) => void, checkFn?: (ev: MatrixEvent) => boolean): void {
        if (!checkFn) checkFn = () => true;

        const mxEvent = this.props.mxEvent;
        const editEvent = mxEvent.replacingEvent();
        const redactEvent = mxEvent.localRedactionEvent();
        const tryOrder = [redactEvent, editEvent, mxEvent];
        for (const ev of tryOrder) {
            if (ev && checkFn(ev)) {
                fn(ev);
                break;
            }
        }
    }

    private onResendClick = (ev: React.MouseEvent): void => {
        this.runActionOnFailedEv((tarEv) => Resend.resend(tarEv));
    };

    private onCancelClick = (ev: React.MouseEvent): void => {
        this.runActionOnFailedEv(
            (tarEv) => Resend.removeFromQueue(tarEv),
            (testEv) => canCancel(testEv.status),
        );
    };

    public render(): JSX.Element {
        const toolbarOpts = [];
        if (canEditContent(this.props.mxEvent)) {
            toolbarOpts.push(<RovingAccessibleTooltipButton
                className="mx_MessageActionBar_maskButton mx_MessageActionBar_editButton"
                title={_t("Edit")}
                onClick={this.onEditClick}
                key="edit"
            />);
        }

        const cancelSendingButton = <RovingAccessibleTooltipButton
            className="mx_MessageActionBar_maskButton mx_MessageActionBar_cancelButton"
            title={_t("Delete")}
            onClick={this.onCancelClick}
            key="cancel"
        />;

        // We show a different toolbar for failed events, so detect that first.
        const mxEvent = this.props.mxEvent;
        const editStatus = mxEvent.replacingEvent() && mxEvent.replacingEvent().status;
        const redactStatus = mxEvent.localRedactionEvent() && mxEvent.localRedactionEvent().status;
        const allowCancel = canCancel(mxEvent.status) || canCancel(editStatus) || canCancel(redactStatus);
        const isFailed = [mxEvent.status, editStatus, redactStatus].includes(EventStatus.NOT_SENT);
        if (allowCancel && isFailed) {
            // The resend button needs to appear ahead of the edit button, so insert to the
            // start of the opts
            toolbarOpts.splice(0, 0, <RovingAccessibleTooltipButton
                className="mx_MessageActionBar_maskButton mx_MessageActionBar_resendButton"
                title={_t("Retry")}
                onClick={this.onResendClick}
                key="resend"
            />);

            // The delete button should appear last, so we can just drop it at the end
            toolbarOpts.push(cancelSendingButton);
        } else {
            if (isContentActionable(this.props.mxEvent)) {
                // Like the resend button, the react and reply buttons need to appear before the edit.
                // The only catch is we do the reply button first so that we can make sure the react
                // button is the very first button without having to do length checks for `splice()`.
                if (this.context.canReply) {
                    toolbarOpts.splice(0, 0, <>
                        <RovingAccessibleTooltipButton
                            className="mx_MessageActionBar_maskButton mx_MessageActionBar_replyButton"
                            title={_t("Reply")}
                            onClick={this.onReplyClick}
                            key="reply"
                        />
                        { (this.showReplyInThreadAction) && (
                            <RovingAccessibleTooltipButton
                                className="mx_MessageActionBar_maskButton mx_MessageActionBar_threadButton"
                                title={_t("Reply in thread")}
                                onClick={this.onThreadClick}
                                key="thread"
                            />
                        ) }
                    </>);
                }
                if (this.context.canReact) {
                    toolbarOpts.splice(0, 0, <ReactButton
                        mxEvent={this.props.mxEvent}
                        reactions={this.props.reactions}
                        onFocusChange={this.onFocusChange}
                        key="react"
                    />);
                }

                // XXX: Assuming that the underlying tile will be a media event if it is eligible media.
                if (MediaEventHelper.isEligible(this.props.mxEvent)) {
                    toolbarOpts.splice(0, 0, <DownloadActionButton
                        mxEvent={this.props.mxEvent}
                        mediaEventHelperGet={() => this.props.getTile?.().getMediaHelper?.()}
                        key="download"
                    />);
                }
            }
            // Show thread icon even for deleted messages, but only within main timeline
            if (this.context.timelineRenderingType === TimelineRenderingType.Room &&
                SettingsStore.getValue("feature_thread") &&
                this.props.mxEvent.getThread() &&
                !isContentActionable(this.props.mxEvent)
            ) {
                toolbarOpts.unshift(<RovingAccessibleTooltipButton
                    className="mx_MessageActionBar_maskButton mx_MessageActionBar_threadButton"
                    title={_t("Reply in thread")}
                    onClick={this.onThreadClick}
                    key="thread"
                />);
            }

            if (allowCancel) {
                toolbarOpts.push(cancelSendingButton);
            }

            if (this.props.isQuoteExpanded !== undefined && ReplyChain.hasReply(this.props.mxEvent)) {
                const expandClassName = classNames({
                    'mx_MessageActionBar_maskButton': true,
                    'mx_MessageActionBar_expandMessageButton': !this.props.isQuoteExpanded,
                    'mx_MessageActionBar_collapseMessageButton': this.props.isQuoteExpanded,
                });
                toolbarOpts.push(<RovingAccessibleTooltipButton
                    className={expandClassName}
                    title={this.props.isQuoteExpanded ? _t("Collapse quotes │ ⇧+click") : _t("Expand quotes │ ⇧+click")}
                    onClick={this.props.toggleThreadExpanded}
                    key="expand"
                />);
            }

            // The menu button should be last, so dump it there.
            toolbarOpts.push(<OptionsButton
                mxEvent={this.props.mxEvent}
                getReplyChain={this.props.getReplyChain}
                getTile={this.props.getTile}
                permalinkCreator={this.props.permalinkCreator}
                onFocusChange={this.onFocusChange}
                key="menu"
                getRelationsForEvent={this.props.getRelationsForEvent}
            />);
        }

        // aria-live=off to not have this read out automatically as navigating around timeline, gets repetitive.
        return <Toolbar className="mx_MessageActionBar" aria-label={_t("Message Actions")} aria-live="off">
            { toolbarOpts }
        </Toolbar>;
    }
}
