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

import React, { ReactElement, useContext, useEffect } from 'react';
import { EventStatus, MatrixEvent, MatrixEventEvent } from 'matrix-js-sdk/src/models/event';
import classNames from 'classnames';
import { MsgType, RelationType } from 'matrix-js-sdk/src/@types/event';
import { Thread } from 'matrix-js-sdk/src/models/thread';
import { M_BEACON_INFO } from 'matrix-js-sdk/src/@types/beacon';

import type { Relations } from 'matrix-js-sdk/src/models/relations';
import { _t } from '../../../languageHandler';
import dis from '../../../dispatcher/dispatcher';
import ContextMenu, { aboveLeftOf, ContextMenuTooltipButton, useContextMenu } from '../../structures/ContextMenu';
import { isContentActionable, canEditContent, editEvent, canCancel } from '../../../utils/EventUtils';
import RoomContext, { TimelineRenderingType } from "../../../contexts/RoomContext";
import Toolbar from "../../../accessibility/Toolbar";
import { RovingAccessibleTooltipButton, useRovingTabIndex } from "../../../accessibility/RovingTabIndex";
import MessageContextMenu from "../context_menus/MessageContextMenu";
import Resend from "../../../Resend";
import { MatrixClientPeg } from "../../../MatrixClientPeg";
import { MediaEventHelper } from "../../../utils/MediaEventHelper";
import DownloadActionButton from "./DownloadActionButton";
import SettingsStore from '../../../settings/SettingsStore';
import { RoomPermalinkCreator } from '../../../utils/permalinks/Permalinks';
import ReplyChain from '../elements/ReplyChain';
import ReactionPicker from "../emojipicker/ReactionPicker";
import { CardContext } from '../right_panel/context';
import { showThread } from "../../../dispatcher/dispatch-actions/threads";
import { shouldDisplayReply } from '../../../utils/Reply';
import { Key } from "../../../Keyboard";
import { ALTERNATE_KEY_NAME } from "../../../accessibility/KeyboardShortcuts";
import { UserTab } from '../dialogs/UserTab';
import { Action } from '../../../dispatcher/actions';
import SdkConfig from "../../../SdkConfig";

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

    const onOptionsClick = (e: React.MouseEvent): void => {
        // Don't open the regular browser or our context menu on right-click
        e.preventDefault();
        e.stopPropagation();
        openMenu();
        // when the context menu is opened directly, e.g. via mouse click, the onFocus handler which tracks
        // the element that is currently focused is skipped. So we want to call onFocus manually to keep the
        // position in the page even when someone is clicking around.
        onFocus();
    };

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
            onClick={onOptionsClick}
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

interface IReplyInThreadButton {
    mxEvent: MatrixEvent;
}

const ReplyInThreadButton = ({ mxEvent }: IReplyInThreadButton) => {
    const context = useContext(CardContext);

    const relationType = mxEvent?.getRelation()?.rel_type;
    const hasARelation = !!relationType && relationType !== RelationType.Thread;
    const firstTimeSeeingThreads = !localStorage.getItem("mx_seen_feature_thread");
    const threadsEnabled = SettingsStore.getValue("feature_thread");

    if (!threadsEnabled && !Thread.hasServerSideSupport) {
        // hide the prompt if the user would only have degraded mode
        return null;
    }

    const onClick = (): void => {
        if (firstTimeSeeingThreads) {
            localStorage.setItem("mx_seen_feature_thread", "true");
        }

        if (!SettingsStore.getValue("feature_thread")) {
            dis.dispatch({
                action: Action.ViewUserSettings,
                initialTabId: UserTab.Labs,
            });
        } else if (mxEvent.isThreadRelation) {
            showThread({
                rootEvent: mxEvent.getThread().rootEvent,
                initialEvent: mxEvent,
                scroll_into_view: true,
                highlighted: true,
                push: context.isCard,
            });
        } else {
            showThread({
                rootEvent: mxEvent,
                push: context.isCard,
            });
        }
    };

    return <RovingAccessibleTooltipButton
        className="mx_MessageActionBar_maskButton mx_MessageActionBar_threadButton"

        disabled={hasARelation}
        tooltip={<>
            <div className="mx_Tooltip_title">
                { !hasARelation
                    ? _t("Reply in thread")
                    : _t("Can't create a thread from an event with an existing relation") }
            </div>
            { !hasARelation && (
                <div className="mx_Tooltip_sub">
                    { SettingsStore.getValue("feature_thread")
                        ? _t("Beta feature")
                        : _t("Beta feature. Click to learn more.")
                    }
                </div>
            ) }
        </>}

        title={!hasARelation
            ? _t("Reply in thread")
            : _t("Can't create a thread from an event with an existing relation")}

        onClick={onClick}
    >
        { firstTimeSeeingThreads && !threadsEnabled && (
            <div className="mx_Indicator" />
        ) }
    </RovingAccessibleTooltipButton>;
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
        relationType: RelationType | string,
        eventType: string
    ) => Relations;
}

export default class MessageActionBar extends React.PureComponent<IMessageActionBarProps> {
    public static contextType = RoomContext;

    public componentDidMount(): void {
        if (this.props.mxEvent.status && this.props.mxEvent.status !== EventStatus.SENT) {
            this.props.mxEvent.on(MatrixEventEvent.Status, this.onSent);
        }

        const client = MatrixClientPeg.get();
        client.decryptEventIfNeeded(this.props.mxEvent);

        if (this.props.mxEvent.isBeingDecrypted()) {
            this.props.mxEvent.once(MatrixEventEvent.Decrypted, this.onDecrypted);
        }
        this.props.mxEvent.on(MatrixEventEvent.BeforeRedaction, this.onBeforeRedaction);
    }

    public componentWillUnmount(): void {
        this.props.mxEvent.off(MatrixEventEvent.Status, this.onSent);
        this.props.mxEvent.off(MatrixEventEvent.Decrypted, this.onDecrypted);
        this.props.mxEvent.off(MatrixEventEvent.BeforeRedaction, this.onBeforeRedaction);
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

    private onEditClick = (): void => {
        editEvent(this.props.mxEvent, this.context.timelineRenderingType, this.props.getRelationsForEvent);
    };

    private readonly forbiddenThreadHeadMsgType = [
        MsgType.KeyVerificationRequest,
    ];

    private get showReplyInThreadAction(): boolean {
        if (!SettingsStore.getValue("feature_thread") && !Thread.hasServerSideSupport) {
            // hide the prompt if the user would only have degraded mode
            return null;
        }

        if (!SettingsStore.getBetaInfo("feature_thread") &&
            !SettingsStore.getValue("feature_thread") &&
            !SdkConfig.get("show_labs_settings")
        ) {
            // Hide the beta prompt if there is no UI to enable it,
            // e.g if config.json disables it and doesn't enable show labs flags
            return false;
        }

        const inNotThreadTimeline = this.context.timelineRenderingType !== TimelineRenderingType.Thread;

        const isAllowedMessageType = (
            !this.forbiddenThreadHeadMsgType.includes(
                this.props.mxEvent.getContent().msgtype as MsgType) &&
            /** forbid threads from live location shares
             * until cross-platform support
             * (PSF-1041)
             */
            !M_BEACON_INFO.matches(this.props.mxEvent.getType())
        );

        return inNotThreadTimeline && isAllowedMessageType;
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

        const threadTooltipButton = <ReplyInThreadButton mxEvent={this.props.mxEvent} key="reply_thread" />;

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
                if (this.context.canSendMessages) {
                    if (this.showReplyInThreadAction) {
                        toolbarOpts.splice(0, 0, threadTooltipButton);
                    }
                    toolbarOpts.splice(0, 0, (
                        <RovingAccessibleTooltipButton
                            className="mx_MessageActionBar_maskButton mx_MessageActionBar_replyButton"
                            title={_t("Reply")}
                            onClick={this.onReplyClick}
                            key="reply"
                        />
                    ));
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
            } else if (SettingsStore.getValue("feature_thread") &&
                // Show thread icon even for deleted messages, but only within main timeline
                this.context.timelineRenderingType === TimelineRenderingType.Room &&
                this.props.mxEvent.getThread()
            ) {
                toolbarOpts.unshift(threadTooltipButton);
            }

            if (allowCancel) {
                toolbarOpts.push(cancelSendingButton);
            }

            if (this.props.isQuoteExpanded !== undefined && shouldDisplayReply(this.props.mxEvent)) {
                const expandClassName = classNames({
                    'mx_MessageActionBar_maskButton': true,
                    'mx_MessageActionBar_expandMessageButton': !this.props.isQuoteExpanded,
                    'mx_MessageActionBar_collapseMessageButton': this.props.isQuoteExpanded,
                });
                const tooltip = <>
                    <div className="mx_Tooltip_title">
                        { this.props.isQuoteExpanded ? _t("Collapse quotes") : _t("Expand quotes") }
                    </div>
                    <div className="mx_Tooltip_sub">
                        { _t(ALTERNATE_KEY_NAME[Key.SHIFT]) + " + " + _t("Click") }
                    </div>
                </>;
                toolbarOpts.push(<RovingAccessibleTooltipButton
                    className={expandClassName}
                    title={this.props.isQuoteExpanded ? _t("Collapse quotes") : _t("Expand quotes")}
                    tooltip={tooltip}
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
