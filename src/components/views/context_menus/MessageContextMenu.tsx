/*
Copyright 2024 New Vector Ltd.
Copyright 2015-2023 The Matrix.org Foundation C.I.C.
Copyright 2021, 2022 Šimon Brandner <simon.bra.ag@gmail.com>
Copyright 2019 Michael Telatynski <7t3chguy@gmail.com>

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX, createRef, useContext } from "react";
import {
    EventStatus,
    type MatrixEvent,
    MatrixEventEvent,
    RoomMemberEvent,
    EventType,
    RelationType,
    type Relations,
    Thread,
    M_POLL_START,
} from "matrix-js-sdk/src/matrix";

import { MatrixClientPeg } from "../../../MatrixClientPeg";
import dis from "../../../dispatcher/dispatcher";
import { _t } from "../../../languageHandler";
import Modal from "../../../Modal";
import Resend from "../../../Resend";
import SettingsStore from "../../../settings/SettingsStore";
import { isUrlPermitted } from "../../../HtmlUtils";
import { canEditContent, editEvent, isContentActionable } from "../../../utils/EventUtils";
import IconizedContextMenu, { IconizedContextMenuOption, IconizedContextMenuOptionList } from "./IconizedContextMenu";
import { Action } from "../../../dispatcher/actions";
import { type RoomPermalinkCreator } from "../../../utils/permalinks/Permalinks";
import { type ButtonEvent } from "../elements/AccessibleButton";
import { copyPlaintext, getSelectedText } from "../../../utils/strings";
import ContextMenu, { toRightOf, type MenuProps } from "../../structures/ContextMenu";
import ReactionPicker from "../emojipicker/ReactionPicker";
import ViewSource from "../../structures/ViewSource";
import { createRedactEventDialog } from "../dialogs/ConfirmRedactDialog";
import { ShareDialog } from "../dialogs/ShareDialog";
import RoomContext, { TimelineRenderingType } from "../../../contexts/RoomContext";
import EndPollDialog from "../dialogs/EndPollDialog";
import { isPollEnded } from "../messages/MPollBody";
import { type ViewRoomPayload } from "../../../dispatcher/payloads/ViewRoomPayload";
import { type GetRelationsForEvent, type IEventTileOps } from "../rooms/EventTile";
import { type OpenForwardDialogPayload } from "../../../dispatcher/payloads/OpenForwardDialogPayload";
import { type OpenReportEventDialogPayload } from "../../../dispatcher/payloads/OpenReportEventDialogPayload";
import { createMapSiteLinkFromEvent } from "../../../utils/location";
import { getForwardableEvent } from "../../../events/forward/getForwardableEvent";
import { getShareableLocationEvent } from "../../../events/location/getShareableLocationEvent";
import { type ShowThreadPayload } from "../../../dispatcher/payloads/ShowThreadPayload";
import { CardContext } from "../right_panel/context";
import PinningUtils from "../../../utils/PinningUtils";
import PosthogTrackers from "../../../PosthogTrackers.ts";

interface IReplyInThreadButton {
    mxEvent: MatrixEvent;
    closeMenu: () => void;
}

const ReplyInThreadButton: React.FC<IReplyInThreadButton> = ({ mxEvent, closeMenu }) => {
    const context = useContext(CardContext);
    const relationType = mxEvent?.getRelation()?.rel_type;

    // Can't create a thread from an event with an existing relation
    if (Boolean(relationType) && relationType !== RelationType.Thread) return null;

    const onClick = (): void => {
        if (mxEvent.getThread() && !mxEvent.isThreadRoot) {
            dis.dispatch<ShowThreadPayload>({
                action: Action.ShowThread,
                rootEvent: mxEvent.getThread()!.rootEvent!,
                initialEvent: mxEvent,
                scroll_into_view: true,
                highlighted: true,
                push: context.isCard,
            });
        } else {
            dis.dispatch<ShowThreadPayload>({
                action: Action.ShowThread,
                rootEvent: mxEvent,
                push: context.isCard,
            });
        }
        closeMenu();
    };

    return (
        <IconizedContextMenuOption
            iconClassName="mx_MessageContextMenu_iconReplyInThread"
            label={_t("action|reply_in_thread")}
            onClick={onClick}
        />
    );
};

interface IProps extends MenuProps {
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
    reactions?: Relations | null;
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
    public static contextType = RoomContext;
    declare public context: React.ContextType<typeof RoomContext>;

    private reactButtonRef = createRef<any>(); // XXX Ref to a functional component

    public constructor(props: IProps) {
        super(props);

        this.state = {
            canRedact: false,
            canPin: false,
            reactionPickerDisplayed: false,
        };
    }

    public componentDidMount(): void {
        MatrixClientPeg.safeGet().on(RoomMemberEvent.PowerLevel, this.checkPermissions);

        // re-check the permissions on send progress (`maySendRedactionForEvent` only returns true for events that have
        // been fully sent and echoed back, and we want to ensure the "Remove" option is added once that happens.)
        this.props.mxEvent.on(MatrixEventEvent.Status, this.checkPermissions);

        this.checkPermissions();
    }

    public componentWillUnmount(): void {
        const cli = MatrixClientPeg.get();
        if (cli) {
            cli.removeListener(RoomMemberEvent.PowerLevel, this.checkPermissions);
        }
        this.props.mxEvent.removeListener(MatrixEventEvent.Status, this.checkPermissions);
    }

    private checkPermissions = (): void => {
        const cli = MatrixClientPeg.safeGet();
        const room = cli.getRoom(this.props.mxEvent.getRoomId());

        // We explicitly decline to show the redact option on ACL events as it has a potential
        // to obliterate the room - https://github.com/matrix-org/synapse/issues/4042
        // Similarly for encryption events, since redacting them "breaks everything"
        const canRedact =
            !!room?.currentState.maySendRedactionForEvent(this.props.mxEvent, cli.getSafeUserId()) &&
            this.props.mxEvent.getType() !== EventType.RoomServerAcl &&
            this.props.mxEvent.getType() !== EventType.RoomEncryption;

        const canPin = PinningUtils.canPin(cli, this.props.mxEvent) || PinningUtils.canUnpin(cli, this.props.mxEvent);

        this.setState({ canRedact, canPin });
    };

    private canEndPoll(mxEvent: MatrixEvent): boolean {
        return (
            M_POLL_START.matches(mxEvent.getType()) &&
            this.state.canRedact &&
            !isPollEnded(mxEvent, MatrixClientPeg.safeGet())
        );
    }

    private onResendReactionsClick = (): void => {
        for (const reaction of this.getUnsentReactions()) {
            Resend.resend(MatrixClientPeg.safeGet(), reaction);
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
        Modal.createDialog(
            ViewSource,
            {
                mxEvent: this.props.mxEvent,
            },
            "mx_Dialog_viewsource",
        );
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

    private onForwardClick = (forwardableEvent: MatrixEvent) => (): void => {
        dis.dispatch<OpenForwardDialogPayload>({
            action: Action.OpenForwardDialog,
            event: forwardableEvent,
            permalinkCreator: this.props.permalinkCreator,
        });
        this.closeMenu();
    };

    private onPinClick = (isPinned: boolean): void => {
        // Pin or unpin in background
        PinningUtils.pinOrUnpinEvent(MatrixClientPeg.safeGet(), this.props.mxEvent);
        PosthogTrackers.trackPinUnpinMessage(isPinned ? "Pin" : "Unpin", "Timeline");

        this.closeMenu();
    };

    private closeMenu = (): void => {
        this.props.onFinished();
    };

    private onUnhidePreviewClick = (): void => {
        this.props.eventTileOps?.unhideWidget();
        this.closeMenu();
    };

    private onShareClick = (e: ButtonEvent): void => {
        e.preventDefault();
        Modal.createDialog(ShareDialog, {
            target: this.props.mxEvent,
            permalinkCreator: this.props.permalinkCreator,
        });
        this.closeMenu();
    };

    private onCopyLinkClick = (e: ButtonEvent): void => {
        e.preventDefault(); // So that we don't open the permalink
        if (!this.props.link) return;
        copyPlaintext(this.props.link);
        this.closeMenu();
    };

    private onCollapseReplyChainClick = (): void => {
        this.props.collapseReplyChain?.();
        this.closeMenu();
    };

    private onCopyClick = (): void => {
        copyPlaintext(getSelectedText());
        this.closeMenu();
    };

    private onEditClick = (): void => {
        editEvent(
            MatrixClientPeg.safeGet(),
            this.props.mxEvent,
            this.context.timelineRenderingType,
            this.props.getRelationsForEvent,
        );
        this.closeMenu();
    };

    private onReplyClick = (): void => {
        dis.dispatch({
            action: "reply_to_event",
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
        const matrixClient = MatrixClientPeg.safeGet();
        Modal.createDialog(
            EndPollDialog,
            {
                matrixClient,
                event: this.props.mxEvent,
                getRelationsForEvent: this.props.getRelationsForEvent,
            },
            "mx_Dialog_endPoll",
        );
        this.closeMenu();
    };

    private getReactions(filter: (e: MatrixEvent) => boolean): MatrixEvent[] {
        const cli = MatrixClientPeg.safeGet();
        const room = cli.getRoom(this.props.mxEvent.getRoomId());
        const eventId = this.props.mxEvent.getId();
        return (
            room?.getPendingEvents().filter((e) => {
                const relation = e.getRelation();
                return relation?.rel_type === RelationType.Annotation && relation.event_id === eventId && filter(e);
            }) ?? []
        );
    }

    private getUnsentReactions(): MatrixEvent[] {
        return this.getReactions((e) => e.status === EventStatus.NOT_SENT);
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

    public render(): React.ReactNode {
        const cli = MatrixClientPeg.safeGet();
        const me = cli.getUserId();
        const { mxEvent, rightClick, link, eventTileOps, reactions, collapseReplyChain, ...other } = this.props;
        delete other.getRelationsForEvent;
        delete other.permalinkCreator;

        const eventStatus = mxEvent.status;
        const unsentReactionsCount = this.getUnsentReactions().length;
        const contentActionable = isContentActionable(mxEvent);
        const permalink = this.props.permalinkCreator?.forEvent(this.props.mxEvent.getId()!);
        // status is SENT before remote-echo, null after
        const isSent = !eventStatus || eventStatus === EventStatus.SENT;
        const { timelineRenderingType, canReact, canSendMessages } = this.context;
        const isThread =
            timelineRenderingType === TimelineRenderingType.Thread ||
            timelineRenderingType === TimelineRenderingType.ThreadsList;
        const isThreadRootEvent = isThread && mxEvent?.getThread()?.rootEvent === mxEvent;

        let resendReactionsButton: JSX.Element | undefined;
        if (!mxEvent.isRedacted() && unsentReactionsCount !== 0) {
            resendReactionsButton = (
                <IconizedContextMenuOption
                    iconClassName="mx_MessageContextMenu_iconResend"
                    label={_t("timeline|context_menu|resent_unsent_reactions", { unsentCount: unsentReactionsCount })}
                    onClick={this.onResendReactionsClick}
                />
            );
        }

        let redactButton: JSX.Element | undefined;
        if (isSent && this.state.canRedact) {
            redactButton = (
                <IconizedContextMenuOption
                    iconClassName="mx_MessageContextMenu_iconRedact"
                    label={_t("action|remove")}
                    onClick={this.onRedactClick}
                />
            );
        }

        let openInMapSiteButton: JSX.Element | undefined;
        const shareableLocationEvent = getShareableLocationEvent(mxEvent, cli);
        if (shareableLocationEvent) {
            const mapSiteLink = createMapSiteLinkFromEvent(shareableLocationEvent);
            openInMapSiteButton = (
                <IconizedContextMenuOption
                    iconClassName="mx_MessageContextMenu_iconOpenInMapSite"
                    onClick={null}
                    label={_t("timeline|context_menu|open_in_osm")}
                    element="a"
                    {...{
                        href: mapSiteLink,
                        target: "_blank",
                        rel: "noreferrer noopener",
                    }}
                />
            );
        }

        let forwardButton: JSX.Element | undefined;
        const forwardableEvent = getForwardableEvent(mxEvent, cli);
        if (contentActionable && forwardableEvent) {
            forwardButton = (
                <IconizedContextMenuOption
                    iconClassName="mx_MessageContextMenu_iconForward"
                    label={_t("action|forward")}
                    onClick={this.onForwardClick(forwardableEvent)}
                />
            );
        }

        // This is specifically not behind the developerMode flag to give people insight into the Matrix
        const viewSourceButton = (
            <IconizedContextMenuOption
                iconClassName="mx_MessageContextMenu_iconSource"
                label={_t("timeline|context_menu|view_source")}
                onClick={this.onViewSourceClick}
            />
        );

        let unhidePreviewButton: JSX.Element | undefined;
        if (eventTileOps?.isWidgetHidden()) {
            unhidePreviewButton = (
                <IconizedContextMenuOption
                    iconClassName="mx_MessageContextMenu_iconUnhidePreview"
                    label={_t("timeline|context_menu|show_url_preview")}
                    onClick={this.onUnhidePreviewClick}
                />
            );
        }

        let permalinkButton: JSX.Element | undefined;
        if (permalink) {
            permalinkButton = (
                <IconizedContextMenuOption
                    iconClassName="mx_MessageContextMenu_iconPermalink"
                    onClick={this.onShareClick}
                    label={_t("action|share")}
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

        let endPollButton: JSX.Element | undefined;
        if (this.canEndPoll(mxEvent)) {
            endPollButton = (
                <IconizedContextMenuOption
                    iconClassName="mx_MessageContextMenu_iconEndPoll"
                    label={_t("poll|end_title")}
                    onClick={this.onEndPollClick}
                />
            );
        }

        // Bridges can provide a 'external_url' to link back to the source.
        let externalURLButton: JSX.Element | undefined;
        if (
            typeof mxEvent.getContent().external_url === "string" &&
            isUrlPermitted(mxEvent.getContent().external_url)
        ) {
            externalURLButton = (
                <IconizedContextMenuOption
                    iconClassName="mx_MessageContextMenu_iconLink"
                    onClick={this.closeMenu}
                    label={_t("timeline|context_menu|external_url")}
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

        let collapseReplyChainButton: JSX.Element | undefined;
        if (collapseReplyChain) {
            collapseReplyChainButton = (
                <IconizedContextMenuOption
                    iconClassName="mx_MessageContextMenu_iconCollapse"
                    label={_t("timeline|context_menu|collapse_reply_thread")}
                    onClick={this.onCollapseReplyChainClick}
                />
            );
        }

        let jumpToRelatedEventButton: JSX.Element | undefined;
        const relatedEventId = mxEvent.getAssociatedId();
        if (relatedEventId && SettingsStore.getValue("developerMode")) {
            jumpToRelatedEventButton = (
                <IconizedContextMenuOption
                    iconClassName="mx_MessageContextMenu_jumpToEvent"
                    label={_t("timeline|context_menu|view_related_event")}
                    onClick={() => this.onJumpToRelatedEventClick(relatedEventId)}
                />
            );
        }

        let reportEventButton: JSX.Element | undefined;
        if (mxEvent.getSender() !== me) {
            reportEventButton = (
                <IconizedContextMenuOption
                    iconClassName="mx_MessageContextMenu_iconReport"
                    label={_t("timeline|context_menu|report")}
                    onClick={this.onReportEventClick}
                />
            );
        }

        let copyLinkButton: JSX.Element | undefined;
        if (link) {
            copyLinkButton = (
                <IconizedContextMenuOption
                    iconClassName="mx_MessageContextMenu_iconCopy"
                    onClick={this.onCopyLinkClick}
                    label={_t("action|copy_link")}
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

        let copyButton: JSX.Element | undefined;
        if (rightClick && getSelectedText()) {
            copyButton = (
                <IconizedContextMenuOption
                    iconClassName="mx_MessageContextMenu_iconCopy"
                    label={_t("action|copy")}
                    triggerOnMouseDown={true} // We use onMouseDown so that the selection isn't cleared when we click
                    onClick={this.onCopyClick}
                />
            );
        }

        let editButton: JSX.Element | undefined;
        if (rightClick && canEditContent(cli, mxEvent)) {
            editButton = (
                <IconizedContextMenuOption
                    iconClassName="mx_MessageContextMenu_iconEdit"
                    label={_t("action|edit")}
                    onClick={this.onEditClick}
                />
            );
        }

        let replyButton: JSX.Element | undefined;
        if (rightClick && contentActionable && canSendMessages) {
            replyButton = (
                <IconizedContextMenuOption
                    iconClassName="mx_MessageContextMenu_iconReply"
                    label={_t("action|reply")}
                    onClick={this.onReplyClick}
                />
            );
        }

        let replyInThreadButton: JSX.Element | undefined;
        if (
            rightClick &&
            contentActionable &&
            canSendMessages &&
            Thread.hasServerSideSupport &&
            timelineRenderingType !== TimelineRenderingType.Thread
        ) {
            replyInThreadButton = <ReplyInThreadButton mxEvent={mxEvent} closeMenu={this.closeMenu} />;
        }

        let reactButton: JSX.Element | undefined;
        if (rightClick && contentActionable && canReact) {
            reactButton = (
                <IconizedContextMenuOption
                    iconClassName="mx_MessageContextMenu_iconReact"
                    label={_t("action|react")}
                    onClick={this.onReactClick}
                    inputRef={this.reactButtonRef}
                />
            );
        }

        let pinButton: JSX.Element | undefined;
        if (rightClick && this.state.canPin) {
            const isPinned = PinningUtils.isPinned(MatrixClientPeg.safeGet(), this.props.mxEvent);
            pinButton = (
                <IconizedContextMenuOption
                    iconClassName={isPinned ? "mx_MessageContextMenu_iconUnpin" : "mx_MessageContextMenu_iconPin"}
                    label={isPinned ? _t("action|unpin") : _t("action|pin")}
                    onClick={() => this.onPinClick(isPinned)}
                />
            );
        }

        let viewInRoomButton: JSX.Element | undefined;
        if (isThreadRootEvent) {
            viewInRoomButton = (
                <IconizedContextMenuOption
                    iconClassName="mx_MessageContextMenu_iconViewInRoom"
                    label={_t("timeline|mab|view_in_room")}
                    onClick={this.viewInRoom}
                />
            );
        }

        let nativeItemsList: JSX.Element | undefined;
        if (copyButton || copyLinkButton) {
            nativeItemsList = (
                <IconizedContextMenuOptionList>
                    {copyButton}
                    {copyLinkButton}
                </IconizedContextMenuOptionList>
            );
        }

        let quickItemsList: JSX.Element | undefined;
        if (editButton || replyButton || reactButton || pinButton) {
            quickItemsList = (
                <IconizedContextMenuOptionList>
                    {reactButton}
                    {replyButton}
                    {replyInThreadButton}
                    {editButton}
                    {pinButton}
                </IconizedContextMenuOptionList>
            );
        }

        const commonItemsList = (
            <IconizedContextMenuOptionList>
                {viewInRoomButton}
                {openInMapSiteButton}
                {endPollButton}
                {forwardButton}
                {permalinkButton}
                {reportEventButton}
                {externalURLButton}
                {jumpToRelatedEventButton}
                {unhidePreviewButton}
                {viewSourceButton}
                {resendReactionsButton}
                {collapseReplyChainButton}
            </IconizedContextMenuOptionList>
        );

        let redactItemList: JSX.Element | undefined;
        if (redactButton) {
            redactItemList = <IconizedContextMenuOptionList red>{redactButton}</IconizedContextMenuOptionList>;
        }

        let reactionPicker: JSX.Element | undefined;
        if (this.state.reactionPickerDisplayed) {
            const buttonRect = (this.reactButtonRef.current as HTMLElement)?.getBoundingClientRect();
            reactionPicker = (
                <ContextMenu {...toRightOf(buttonRect)} onFinished={this.closeMenu} managed={false}>
                    <ReactionPicker mxEvent={mxEvent} onFinished={this.onCloseReactionPicker} reactions={reactions} />
                </ContextMenu>
            );
        }

        return (
            <React.Fragment>
                <IconizedContextMenu
                    {...other}
                    className="mx_MessageContextMenu"
                    compact={true}
                    data-testid="mx_MessageContextMenu"
                >
                    {nativeItemsList}
                    {quickItemsList}
                    {commonItemsList}
                    {redactItemList}
                </IconizedContextMenu>
                {reactionPicker}
            </React.Fragment>
        );
    }
}
