/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type MouseEvent } from "react";
import { MsgType, type MatrixEvent } from "matrix-js-sdk/src/matrix";
import {
    BaseViewModel,
    LINKIFIED_DATA_ATTRIBUTE,
    TextualBodyViewBodyWrapperKind,
    TextualBodyViewKind,
    type TextualBodyViewModel as TextualBodyViewModelInterface,
    type TextualBodyViewSnapshot,
} from "@element-hq/web-shared-components";

import { formatDate } from "../../../../../DateUtils";
import Modal from "../../../../../Modal";
import dis from "../../../../../dispatcher/dispatcher";
import { _t } from "../../../../../languageHandler";
import { IntegrationManagers } from "../../../../../integrations/IntegrationManagers";
import { tryTransformPermalinkToLocalHref } from "../../../../../utils/permalinks/Permalinks";
import { Action } from "../../../../../dispatcher/actions";
import QuestionDialog from "../../../../../components/views/dialogs/QuestionDialog";
import MessageEditHistoryDialog from "../../../../../components/views/dialogs/MessageEditHistoryDialog";
import { TimelineRenderingType } from "../../../../../contexts/RoomContext";

const CAPTION_MESSAGE_TYPES = new Set<MsgType>([MsgType.Image, MsgType.File, MsgType.Audio, MsgType.Video]);

export interface TextualBodyViewModelProps {
    id?: string;
    mxEvent: MatrixEvent;
    highlightLink?: string;
    replacingEventId?: string;
    isSeeingThroughMessageHiddenForModeration?: boolean;
    timelineRenderingType: TimelineRenderingType;
}

export class TextualBodyViewModel
    extends BaseViewModel<TextualBodyViewSnapshot, TextualBodyViewModelProps>
    implements TextualBodyViewModelInterface
{
    private static readonly getKind = (mxEvent: MatrixEvent): TextualBodyViewKind => {
        const msgtype = mxEvent.getContent().msgtype as MsgType | undefined;

        if (msgtype === MsgType.Notice) {
            return TextualBodyViewKind.NOTICE;
        }

        if (msgtype === MsgType.Emote) {
            return TextualBodyViewKind.EMOTE;
        }

        if (msgtype && CAPTION_MESSAGE_TYPES.has(msgtype)) {
            return TextualBodyViewKind.CAPTION;
        }

        return TextualBodyViewKind.TEXT;
    };

    private static readonly getStarterLink = (mxEvent: MatrixEvent): string | undefined => {
        const starterLink = mxEvent.getContent().data?.["org.matrix.neb.starter_link"];

        return typeof starterLink === "string" ? starterLink : undefined;
    };

    private static readonly computeBodyWrapperSnapshot = (
        props: TextualBodyViewModelProps,
    ): Pick<TextualBodyViewSnapshot, "bodyWrapper" | "bodyLinkHref" | "bodyActionAriaLabel"> => {
        if (props.highlightLink) {
            return {
                bodyWrapper: TextualBodyViewBodyWrapperKind.LINK,
                bodyLinkHref: props.highlightLink,
                bodyActionAriaLabel: undefined,
            };
        }

        if (TextualBodyViewModel.getStarterLink(props.mxEvent)) {
            return {
                bodyWrapper: TextualBodyViewBodyWrapperKind.ACTION,
                bodyLinkHref: undefined,
                bodyActionAriaLabel: undefined,
            };
        }

        return {
            bodyWrapper: TextualBodyViewBodyWrapperKind.NONE,
            bodyLinkHref: undefined,
            bodyActionAriaLabel: undefined,
        };
    };

    private static readonly computeEditedMarkerSnapshot = (
        props: TextualBodyViewModelProps,
    ): Pick<
        TextualBodyViewSnapshot,
        "showEditedMarker" | "editedMarkerText" | "editedMarkerTooltip" | "editedMarkerCaption"
    > => {
        if (!props.replacingEventId) {
            return {
                showEditedMarker: false,
                editedMarkerText: undefined,
                editedMarkerTooltip: undefined,
                editedMarkerCaption: undefined,
            };
        }

        const replacingDate = props.mxEvent.replacingEventDate();
        const date = replacingDate ? formatDate(replacingDate) : undefined;

        return {
            showEditedMarker: true,
            editedMarkerText: `(${_t("common|edited")})`,
            editedMarkerTooltip: _t("timeline|edits|tooltip_title", { date }),
            editedMarkerCaption: _t("timeline|edits|tooltip_sub"),
        };
    };

    private static readonly computePendingModerationSnapshot = (
        props: TextualBodyViewModelProps,
    ): Pick<TextualBodyViewSnapshot, "showPendingModerationMarker" | "pendingModerationText"> => {
        if (!props.isSeeingThroughMessageHiddenForModeration) {
            return {
                showPendingModerationMarker: false,
                pendingModerationText: undefined,
            };
        }

        const visibility = props.mxEvent.messageVisibility();
        if (visibility.visible) {
            throw new Error("TextualBodyViewModel should only render pending moderation for hidden messages");
        }

        const text = visibility.reason
            ? _t("timeline|pending_moderation_reason", { reason: visibility.reason })
            : _t("timeline|pending_moderation");

        return {
            showPendingModerationMarker: true,
            pendingModerationText: `(${text})`,
        };
    };

    private static readonly computeEventSnapshot = (
        props: TextualBodyViewModelProps,
    ): Pick<
        TextualBodyViewSnapshot,
        | "kind"
        | "bodyWrapper"
        | "bodyLinkHref"
        | "bodyActionAriaLabel"
        | "showEditedMarker"
        | "editedMarkerText"
        | "editedMarkerTooltip"
        | "editedMarkerCaption"
        | "showPendingModerationMarker"
        | "pendingModerationText"
        | "emoteSenderName"
    > => ({
        kind: TextualBodyViewModel.getKind(props.mxEvent),
        emoteSenderName: props.mxEvent.sender?.name ?? props.mxEvent.getSender(),
        ...TextualBodyViewModel.computeBodyWrapperSnapshot(props),
        ...TextualBodyViewModel.computeEditedMarkerSnapshot(props),
        ...TextualBodyViewModel.computePendingModerationSnapshot(props),
    });

    private static readonly computeSnapshot = (props: TextualBodyViewModelProps): TextualBodyViewSnapshot => ({
        id: props.id,
        ...TextualBodyViewModel.computeEventSnapshot(props),
    });

    public constructor(props: TextualBodyViewModelProps) {
        super(props, TextualBodyViewModel.computeSnapshot(props));
    }

    public setId(id: string | undefined): void {
        if (this.props.id === id) return;

        this.props = {
            ...this.props,
            id,
        };

        this.snapshot.merge({ id });
    }

    public setEvent(mxEvent: MatrixEvent): void {
        if (this.props.mxEvent === mxEvent) return;

        this.props = {
            ...this.props,
            mxEvent,
        };

        this.snapshot.merge(TextualBodyViewModel.computeEventSnapshot(this.props));
    }

    public setHighlightLink(highlightLink: string | undefined): void {
        if (this.props.highlightLink === highlightLink) return;

        this.props = {
            ...this.props,
            highlightLink,
        };

        this.snapshot.merge(TextualBodyViewModel.computeBodyWrapperSnapshot(this.props));
    }

    public setReplacingEventId(replacingEventId: string | undefined): void {
        if (this.props.replacingEventId === replacingEventId) return;

        this.props = {
            ...this.props,
            replacingEventId,
        };

        this.snapshot.merge(TextualBodyViewModel.computeEditedMarkerSnapshot(this.props));
    }

    public setIsSeeingThroughMessageHiddenForModeration(
        isSeeingThroughMessageHiddenForModeration: boolean | undefined,
    ): void {
        if (this.props.isSeeingThroughMessageHiddenForModeration === isSeeingThroughMessageHiddenForModeration) return;

        this.props = {
            ...this.props,
            isSeeingThroughMessageHiddenForModeration,
        };

        this.snapshot.merge(TextualBodyViewModel.computePendingModerationSnapshot(this.props));
    }

    public setTimelineRenderingType(timelineRenderingType: TimelineRenderingType): void {
        if (this.props.timelineRenderingType === timelineRenderingType) return;

        this.props = {
            ...this.props,
            timelineRenderingType,
        };
    }

    public onRootClick = (event: MouseEvent<HTMLDivElement>): void => {
        let target: HTMLLinkElement | null = event.target as HTMLLinkElement;

        if (target.dataset?.[LINKIFIED_DATA_ATTRIBUTE]) {
            return;
        }

        if (target.nodeName !== "A") {
            target = target.closest<HTMLLinkElement>("a");
        }

        if (!target) {
            return;
        }

        const localHref = tryTransformPermalinkToLocalHref(target.href);
        if (localHref !== target.href) {
            event.preventDefault();
            window.location.hash = localHref;
        }
    };

    public onBodyActionClick = (event: MouseEvent<HTMLElement>): void => {
        event.preventDefault();

        const starterLink = TextualBodyViewModel.getStarterLink(this.props.mxEvent);
        if (!starterLink) {
            return;
        }

        const managers = IntegrationManagers.sharedInstance();
        if (!managers.hasManager()) {
            managers.openNoManagerDialog();
            return;
        }

        const integrationManager = managers.getPrimaryManager();
        const scalarClient = integrationManager?.getScalarClient();
        scalarClient?.connect().then(() => {
            const completeUrl = scalarClient.getStarterLink(starterLink);
            const integrationsUrl = integrationManager!.uiUrl;
            const { finished } = Modal.createDialog(QuestionDialog, {
                title: _t("timeline|scalar_starter_link|dialog_title"),
                description: <div>{_t("timeline|scalar_starter_link|dialog_description", { integrationsUrl })}</div>,
                button: _t("action|continue"),
            });

            finished.then(([confirmed]) => {
                if (!confirmed) {
                    return;
                }

                const width = window.screen.width > 1024 ? 1024 : window.screen.width;
                const height = window.screen.height > 800 ? 800 : window.screen.height;
                const left = (window.screen.width - width) / 2;
                const top = (window.screen.height - height) / 2;
                const features = `height=${height}, width=${width}, top=${top}, left=${left},`;
                const wnd = window.open(completeUrl, "_blank", features)!;
                wnd.opener = null;
            });
        });
    };

    public onEditedMarkerClick = (): void => {
        Modal.createDialog(MessageEditHistoryDialog, { mxEvent: this.props.mxEvent });
    };

    public onEmoteSenderClick = (): void => {
        dis.dispatch({
            action: Action.ComposerInsert,
            userId: this.props.mxEvent.getSender(),
            timelineRenderingType: this.props.timelineRenderingType,
        });
    };
}
