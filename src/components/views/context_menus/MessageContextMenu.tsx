/*
Copyright 2019 Michael Telatynski <7t3chguy@gmail.com>
Copyright 2015 - 2021 The Matrix.org Foundation C.I.C.
Copyright 2021 - 2022 Šimon Brandner <simon.bra.ag@gmail.com>

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
import { EventStatus, MatrixEvent } from 'matrix-js-sdk/src/models/event';
import { EventType, RelationType } from "matrix-js-sdk/src/@types/event";
import { Relations } from 'matrix-js-sdk/src/models/relations';
import { RoomMemberEvent } from "matrix-js-sdk/src/models/room-member";
import { M_POLL_START } from "matrix-events-sdk";

import { MatrixClientPeg } from '../../../MatrixClientPeg';
import dis from '../../../dispatcher/dispatcher';
import { _t } from '../../../languageHandler';
import Modal from '../../../Modal';
import Resend from '../../../Resend';
import SettingsStore from '../../../settings/SettingsStore';
import { isUrlPermitted } from '../../../HtmlUtils';
import { canEditContent, canForward, editEvent, isContentActionable, isLocationEvent } from '../../../utils/EventUtils';
import IconizedContextMenu, { IconizedContextMenuOption, IconizedContextMenuOptionList } from './IconizedContextMenu';
import { ReadPinsEventId } from "../right_panel/types";
import { Action } from "../../../dispatcher/actions";
import { RoomPermalinkCreator } from '../../../utils/permalinks/Permalinks';
import { ButtonEvent } from '../elements/AccessibleButton';
import { copyPlaintext, getSelectedText } from '../../../utils/strings';
import ContextMenu, { toRightOf, IPosition, ChevronFace } from '../../structures/ContextMenu';
import ReactionPicker from '../emojipicker/ReactionPicker';
import ViewSource from '../../structures/ViewSource';
import { createRedactEventDialog } from '../dialogs/ConfirmRedactDialog';
import ShareDialog from '../dialogs/ShareDialog';
import RoomContext, { TimelineRenderingType } from '../../../contexts/RoomContext';
import { ComposerInsertPayload } from "../../../dispatcher/payloads/ComposerInsertPayload";
import EndPollDialog from '../dialogs/EndPollDialog';
import { isPollEnded } from '../messages/MPollBody';
import { ViewRoomPayload } from "../../../dispatcher/payloads/ViewRoomPayload";
import { GetRelationsForEvent, IEventTileOps } from "../rooms/EventTile";
import { OpenForwardDialogPayload } from "../../../dispatcher/payloads/OpenForwardDialogPayload";
import { OpenReportEventDialogPayload } from "../../../dispatcher/payloads/OpenReportEventDialogPayload";
import { createMapSiteLinkFromEvent } from '../../../utils/location';

interface IProps extends IPosition {
    chevronFace: ChevronFace;
    /* the MatrixEvent associated with the context menu */
    mxEvent: MatrixEvent;
    // An optional EventTileOps implementation that can be used to unhide preview widgets
    eventTileOps?: IEventTileOps;
    // Callback called when the menu is dismissed
    permalinkCreator?: RoomPermalinkCreator;
    /* an optional function to be called when the user clicks collapse thread, if not provided hide button */
    collapseReplyChain?(): void;
    /* callback called when the menu is dismissed */
    onFinished(): void;
    // If the menu is inside a dialog, we sometimes need to close that dialog after click (forwarding)
    onCloseDialog?(): void;
    // True if the menu is being used as a right click menu
    rightClick?: boolean;
    // The Relations model from the JS SDK for reactions to `mxEvent`
    reactions?: Relations;
    // A permalink to this event or an href of an anchor element the user has clicked
    link?: string;

    getRelationsForEvent?: GetRelationsForEvent;
}

interface IState {
    canRedact: boolean;
    canPin: boolean;
    reactionPickerDisplayed: boolean;
}

export default class MessageContextMenu extends React.Component<IProps, IState> {
    static contextType = RoomContext;
    public context!: React.ContextType<typeof RoomContext>;

    private reactButtonRef = createRef<any>(); // XXX Ref to a functional component

    constructor(props: IProps) {
        super(props);

        this.state = {
            canRedact: false,
            canPin: false,
            reactionPickerDisplayed: false,
        };
    }

    public componentDidMount() {
        MatrixClientPeg.get().on(RoomMemberEvent.PowerLevel, this.checkPermissions);
        this.checkPermissions();
    }

    public componentWillUnmount(): void {
        const cli = MatrixClientPeg.get();
        if (cli) {
            cli.removeListener(RoomMemberEvent.PowerLevel, this.checkPermissions);
        }
    }

    private checkPermissions = (): void => {
        const cli = MatrixClientPeg.get();
        const room = cli.getRoom(this.props.mxEvent.getRoomId());

        // We explicitly decline to show the redact option on ACL events as it has a potential
        // to obliterate the room - https://github.com/matrix-org/synapse/issues/4042
        // Similarly for encryption events, since redacting them "breaks everything"
        const canRedact = room.currentState.maySendRedactionForEvent(this.props.mxEvent, cli.credentials.userId)
            && this.props.mxEvent.getType() !== EventType.RoomServerAcl
            && this.props.mxEvent.getType() !== EventType.RoomEncryption;
        let canPin = room.currentState.mayClientSendStateEvent(EventType.RoomPinnedEvents, cli);

        // HACK: Intentionally say we can't pin if the user doesn't want to use the functionality
        if (!SettingsStore.getValue("feature_pinning")) canPin = false;

        this.setState({ canRedact, canPin });
    };

    private isPinned(): boolean {
        const room = MatrixClientPeg.get().getRoom(this.props.mxEvent.getRoomId());
        const pinnedEvent = room.currentState.getStateEvents(EventType.RoomPinnedEvents, '');
        if (!pinnedEvent) return false;
        const content = pinnedEvent.getContent();
        return content.pinned && Array.isArray(content.pinned) && content.pinned.includes(this.props.mxEvent.getId());
    }

    private canOpenInMapSite(mxEvent: MatrixEvent): boolean {
        return isLocationEvent(mxEvent);
    }

    private canEndPoll(mxEvent: MatrixEvent): boolean {
        return (
            M_POLL_START.matches(mxEvent.getType()) &&
            this.state.canRedact &&
            !isPollEnded(mxEvent, MatrixClientPeg.get(), this.props.getRelationsForEvent)
        );
    }

    private onResendReactionsClick = (): void => {
        for (const reaction of this.getUnsentReactions()) {
            Resend.resend(reaction);
        }
        this.closeMenu();
    };

    private onJumpToRelatedEventClick = (relatedEventId: string): void => {
        dis.dispatch({
            action: "view_room",
            room_id: this.props.mxEvent.getRoomId(),
            event_id: relatedEventId,
            highlighted: true,
        });
    };

    private onReportEventClick = (): void => {
        dis.dispatch<OpenReportEventDialogPayload>({
            action: Action.OpenReportEventDialog,
            event: this.props.mxEvent,
        });
        this.closeMenu();
    };

    private onViewSourceClick = (): void => {
        Modal.createTrackedDialog('View Event Source', '', ViewSource, {
            mxEvent: this.props.mxEvent,
        }, 'mx_Dialog_viewsource');
        this.closeMenu();
    };

    private onRedactClick = (): void => {
        const { mxEvent, onCloseDialog } = this.props;
        createRedactEventDialog({
            mxEvent,
            onCloseDialog,
        });
        this.closeMenu();
    };

    private onForwardClick = (): void => {
        dis.dispatch<OpenForwardDialogPayload>({
            action: Action.OpenForwardDialog,
            event: this.props.mxEvent,
            permalinkCreator: this.props.permalinkCreator,
        });
        this.closeMenu();
    };

    private onPinClick = (): void => {
        const cli = MatrixClientPeg.get();
        const room = cli.getRoom(this.props.mxEvent.getRoomId());
        const eventId = this.props.mxEvent.getId();

        const pinnedIds = room?.currentState?.getStateEvents(EventType.RoomPinnedEvents, "")?.getContent().pinned || [];
        if (pinnedIds.includes(eventId)) {
            pinnedIds.splice(pinnedIds.indexOf(eventId), 1);
        } else {
            pinnedIds.push(eventId);
            cli.setRoomAccountData(room.roomId, ReadPinsEventId, {
                event_ids: [
                    ...(room.getAccountData(ReadPinsEventId)?.getContent()?.event_ids || []),
                    eventId,
                ],
            });
        }
        cli.sendStateEvent(this.props.mxEvent.getRoomId(), EventType.RoomPinnedEvents, { pinned: pinnedIds }, "");
        this.closeMenu();
    };

    private closeMenu = (): void => {
        this.props.onFinished();
    };

    private onUnhidePreviewClick = (): void => {
        this.props.eventTileOps?.unhideWidget();
        this.closeMenu();
    };

    private onQuoteClick = (): void => {
        dis.dispatch<ComposerInsertPayload>({
            action: Action.ComposerInsert,
            event: this.props.mxEvent,
            timelineRenderingType: this.context.timelineRenderingType,
        });
        this.closeMenu();
    };

    private onShareClick = (e: React.MouseEvent): void => {
        e.preventDefault();
        Modal.createTrackedDialog('share room message dialog', '', ShareDialog, {
            target: this.props.mxEvent,
            permalinkCreator: this.props.permalinkCreator,
        });
        this.closeMenu();
    };

    private onCopyLinkClick = (e: ButtonEvent): void => {
        e.preventDefault(); // So that we don't open the permalink
        copyPlaintext(this.props.link);
        this.closeMenu();
    };

    private onCollapseReplyChainClick = (): void => {
        this.props.collapseReplyChain();
        this.closeMenu();
    };

    private onCopyClick = (): void => {
        copyPlaintext(getSelectedText());
        this.closeMenu();
    };

    private onEditClick = (): void => {
        editEvent(this.props.mxEvent, this.context.timelineRenderingType, this.props.getRelationsForEvent);
        this.closeMenu();
    };

    private onReplyClick = (): void => {
        dis.dispatch({
            action: 'reply_to_event',
            event: this.props.mxEvent,
            context: this.context.timelineRenderingType,
        });
        this.closeMenu();
    };

    private onReactClick = (): void => {
        this.setState({ reactionPickerDisplayed: true });
    };

    private onCloseReactionPicker = (): void => {
        this.setState({ reactionPickerDisplayed: false });
        this.closeMenu();
    };

    private onEndPollClick = (): void => {
        const matrixClient = MatrixClientPeg.get();
        Modal.createTrackedDialog('End Poll', '', EndPollDialog, {
            matrixClient,
            event: this.props.mxEvent,
            getRelationsForEvent: this.props.getRelationsForEvent,
        }, 'mx_Dialog_endPoll');
        this.closeMenu();
    };

    private getReactions(filter: (e: MatrixEvent) => boolean): MatrixEvent[] {
        const cli = MatrixClientPeg.get();
        const room = cli.getRoom(this.props.mxEvent.getRoomId());
        const eventId = this.props.mxEvent.getId();
        return room.getPendingEvents().filter(e => {
            const relation = e.getRelation();
            return relation?.rel_type === RelationType.Annotation && relation.event_id === eventId && filter(e);
        });
    }

    private getUnsentReactions(): MatrixEvent[] {
        return this.getReactions(e => e.status === EventStatus.NOT_SENT);
    }

    private viewInRoom = (): void => {
        dis.dispatch<ViewRoomPayload>({
            action: Action.ViewRoom,
            event_id: this.props.mxEvent.getId(),
            highlighted: true,
            room_id: this.props.mxEvent.getRoomId(),
            metricsTrigger: undefined, // room doesn't change
        });
        this.closeMenu();
    };

    public render(): JSX.Element {
        const cli = MatrixClientPeg.get();
        const me = cli.getUserId();
        const { mxEvent, rightClick, link, eventTileOps, reactions, collapseReplyChain } = this.props;
        const eventStatus = mxEvent.status;
        const unsentReactionsCount = this.getUnsentReactions().length;
        const contentActionable = isContentActionable(mxEvent);
        const permalink = this.props.permalinkCreator?.forEvent(this.props.mxEvent.getId());
        // status is SENT before remote-echo, null after
        const isSent = !eventStatus || eventStatus === EventStatus.SENT;
        const { timelineRenderingType, canReact, canSendMessages } = this.context;
        const isThread = (
            timelineRenderingType === TimelineRenderingType.Thread ||
            timelineRenderingType === TimelineRenderingType.ThreadsList
        );
        const isThreadRootEvent = isThread && mxEvent?.getThread()?.rootEvent === mxEvent;

        let resendReactionsButton: JSX.Element;
        if (!mxEvent.isRedacted() && unsentReactionsCount !== 0) {
            resendReactionsButton = (
                <IconizedContextMenuOption
                    iconClassName="mx_MessageContextMenu_iconResend"
                    label={_t('Resend %(unsentCount)s reaction(s)', { unsentCount: unsentReactionsCount })}
                    onClick={this.onResendReactionsClick}
                />
            );
        }

        let redactButton: JSX.Element;
        if (isSent && this.state.canRedact) {
            redactButton = (
                <IconizedContextMenuOption
                    iconClassName="mx_MessageContextMenu_iconRedact"
                    label={_t("Remove")}
                    onClick={this.onRedactClick}
                />
            );
        }

        let openInMapSiteButton: JSX.Element;
        if (this.canOpenInMapSite(mxEvent)) {
            const mapSiteLink = createMapSiteLinkFromEvent(mxEvent);
            openInMapSiteButton = (
                <IconizedContextMenuOption
                    iconClassName="mx_MessageContextMenu_iconOpenInMapSite"
                    onClick={null}
                    label={_t('Open in OpenStreetMap')}
                    element="a"
                    {
                        ...{
                            href: mapSiteLink,
                            target: "_blank",
                            rel: "noreferrer noopener",
                        }
                    }
                />
            );
        }

        let forwardButton: JSX.Element;
        if (contentActionable && canForward(mxEvent)) {
            forwardButton = (
                <IconizedContextMenuOption
                    iconClassName="mx_MessageContextMenu_iconForward"
                    label={_t("Forward")}
                    onClick={this.onForwardClick}
                />
            );
        }

        let pinButton: JSX.Element;
        if (contentActionable && this.state.canPin) {
            pinButton = (
                <IconizedContextMenuOption
                    iconClassName="mx_MessageContextMenu_iconPin"
                    label={this.isPinned() ? _t('Unpin') : _t('Pin')}
                    onClick={this.onPinClick}
                />
            );
        }

        // This is specifically not behind the developerMode flag to give people insight into the Matrix
        const viewSourceButton = (
            <IconizedContextMenuOption
                iconClassName="mx_MessageContextMenu_iconSource"
                label={_t("View source")}
                onClick={this.onViewSourceClick}
            />
        );

        let unhidePreviewButton: JSX.Element;
        if (eventTileOps?.isWidgetHidden()) {
            unhidePreviewButton = (
                <IconizedContextMenuOption
                    iconClassName="mx_MessageContextMenu_iconUnhidePreview"
                    label={_t("Show preview")}
                    onClick={this.onUnhidePreviewClick}
                />
            );
        }

        let permalinkButton: JSX.Element;
        if (permalink) {
            permalinkButton = (
                <IconizedContextMenuOption
                    iconClassName="mx_MessageContextMenu_iconPermalink"
                    onClick={this.onShareClick}
                    label={_t('Share')}
                    element="a"
                    {
                        // XXX: Typescript signature for AccessibleButton doesn't work properly for non-inputs like `a`
                        ...{
                            href: permalink,
                            target: "_blank",
                            rel: "noreferrer noopener",
                        }
                    }
                />
            );
        }

        let endPollButton: JSX.Element;
        if (this.canEndPoll(mxEvent)) {
            endPollButton = (
                <IconizedContextMenuOption
                    iconClassName="mx_MessageContextMenu_iconEndPoll"
                    label={_t("End Poll")}
                    onClick={this.onEndPollClick}
                />
            );
        }

        let quoteButton: JSX.Element;
        if (eventTileOps) { // this event is rendered using TextualBody
            quoteButton = (
                <IconizedContextMenuOption
                    iconClassName="mx_MessageContextMenu_iconQuote"
                    label={_t("Quote")}
                    onClick={this.onQuoteClick}
                />
            );
        }

        // Bridges can provide a 'external_url' to link back to the source.
        let externalURLButton: JSX.Element;
        if (
            typeof (mxEvent.getContent().external_url) === "string" &&
            isUrlPermitted(mxEvent.getContent().external_url)
        ) {
            externalURLButton = (
                <IconizedContextMenuOption
                    iconClassName="mx_MessageContextMenu_iconLink"
                    onClick={this.closeMenu}
                    label={_t('Source URL')}
                    element="a"
                    {
                        // XXX: Typescript signature for AccessibleButton doesn't work properly for non-inputs like `a`
                        ...{
                            target: "_blank",
                            rel: "noreferrer noopener",
                            href: mxEvent.getContent().external_url,
                        }
                    }
                />
            );
        }

        let collapseReplyChainButton: JSX.Element;
        if (collapseReplyChain) {
            collapseReplyChainButton = (
                <IconizedContextMenuOption
                    iconClassName="mx_MessageContextMenu_iconCollapse"
                    label={_t("Collapse reply thread")}
                    onClick={this.onCollapseReplyChainClick}
                />
            );
        }

        let jumpToRelatedEventButton: JSX.Element;
        const relatedEventId = mxEvent.getWireContent()?.["m.relates_to"]?.event_id;
        if (relatedEventId && SettingsStore.getValue("developerMode")) {
            jumpToRelatedEventButton = (
                <IconizedContextMenuOption
                    iconClassName="mx_MessageContextMenu_jumpToEvent"
                    label={_t("View related event")}
                    onClick={() => this.onJumpToRelatedEventClick(relatedEventId)}
                />
            );
        }

        let reportEventButton: JSX.Element;
        if (mxEvent.getSender() !== me) {
            reportEventButton = (
                <IconizedContextMenuOption
                    iconClassName="mx_MessageContextMenu_iconReport"
                    label={_t("Report")}
                    onClick={this.onReportEventClick}
                />
            );
        }

        let copyLinkButton: JSX.Element;
        if (link) {
            copyLinkButton = (
                <IconizedContextMenuOption
                    iconClassName="mx_MessageContextMenu_iconCopy"
                    onClick={this.onCopyLinkClick}
                    label={_t('Copy link')}
                    element="a"
                    {
                    // XXX: Typescript signature for AccessibleButton doesn't work properly for non-inputs like `a`
                        ...{
                            href: link,
                            target: "_blank",
                            rel: "noreferrer noopener",
                        }
                    }
                />
            );
        }

        let copyButton: JSX.Element;
        if (rightClick && getSelectedText()) {
            copyButton = (
                <IconizedContextMenuOption
                    iconClassName="mx_MessageContextMenu_iconCopy"
                    label={_t("Copy")}
                    triggerOnMouseDown={true} // We use onMouseDown so that the selection isn't cleared when we click
                    onClick={this.onCopyClick}
                />
            );
        }

        let editButton: JSX.Element;
        if (rightClick && canEditContent(mxEvent)) {
            editButton = (
                <IconizedContextMenuOption
                    iconClassName="mx_MessageContextMenu_iconEdit"
                    label={_t("Edit")}
                    onClick={this.onEditClick}
                />
            );
        }

        let replyButton: JSX.Element;
        if (rightClick && contentActionable && canSendMessages) {
            replyButton = (
                <IconizedContextMenuOption
                    iconClassName="mx_MessageContextMenu_iconReply"
                    label={_t("Reply")}
                    onClick={this.onReplyClick}
                />
            );
        }

        let reactButton;
        if (rightClick && contentActionable && canReact) {
            reactButton = (
                <IconizedContextMenuOption
                    iconClassName="mx_MessageContextMenu_iconReact"
                    label={_t("React")}
                    onClick={this.onReactClick}
                    inputRef={this.reactButtonRef}
                />
            );
        }

        let viewInRoomButton: JSX.Element;
        if (isThreadRootEvent) {
            viewInRoomButton = (
                <IconizedContextMenuOption
                    iconClassName="mx_MessageContextMenu_iconViewInRoom"
                    label={_t("View in room")}
                    onClick={this.viewInRoom}
                />
            );
        }

        let nativeItemsList: JSX.Element;
        if (copyButton || copyLinkButton) {
            nativeItemsList = (
                <IconizedContextMenuOptionList>
                    { copyButton }
                    { copyLinkButton }
                </IconizedContextMenuOptionList>
            );
        }

        let quickItemsList: JSX.Element;
        if (editButton || replyButton || reactButton) {
            quickItemsList = (
                <IconizedContextMenuOptionList>
                    { reactButton }
                    { replyButton }
                    { editButton }
                </IconizedContextMenuOptionList>
            );
        }

        const commonItemsList = (
            <IconizedContextMenuOptionList>
                { viewInRoomButton }
                { openInMapSiteButton }
                { endPollButton }
                { quoteButton }
                { forwardButton }
                { pinButton }
                { permalinkButton }
                { reportEventButton }
                { externalURLButton }
                { jumpToRelatedEventButton }
                { unhidePreviewButton }
                { viewSourceButton }
                { resendReactionsButton }
                { collapseReplyChainButton }
            </IconizedContextMenuOptionList>
        );

        let redactItemList: JSX.Element;
        if (redactButton) {
            redactItemList = (
                <IconizedContextMenuOptionList red>
                    { redactButton }
                </IconizedContextMenuOptionList>
            );
        }

        let reactionPicker: JSX.Element;
        if (this.state.reactionPickerDisplayed) {
            const buttonRect = (this.reactButtonRef.current as HTMLElement)?.getBoundingClientRect();
            reactionPicker = (
                <ContextMenu
                    {...toRightOf(buttonRect)}
                    onFinished={this.closeMenu}
                    managed={false}
                >
                    <ReactionPicker
                        mxEvent={mxEvent}
                        onFinished={this.onCloseReactionPicker}
                        reactions={reactions}
                    />
                </ContextMenu>
            );
        }

        return (
            <React.Fragment>
                <IconizedContextMenu
                    {...this.props}
                    className="mx_MessageContextMenu"
                    compact={true}
                    data-testid="mx_MessageContextMenu"
                >
                    { nativeItemsList }
                    { quickItemsList }
                    { commonItemsList }
                    { redactItemList }
                </IconizedContextMenu>
                { reactionPicker }
            </React.Fragment>
        );
    }
}

