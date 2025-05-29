/*
Copyright 2024 New Vector Ltd.
Copyright 2020, 2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import {
    ClientWidgetApi,
    type IModalWidgetCloseRequest,
    type IModalWidgetOpenRequestData,
    type IModalWidgetReturnData,
    type ISetModalButtonEnabledActionRequest,
    type IWidgetApiAcknowledgeResponseData,
    type IWidgetApiErrorResponseData,
    BuiltInModalButtonID,
    type ModalButtonID,
    ModalButtonKind,
    type Widget,
    WidgetApiFromWidgetAction,
    WidgetKind,
} from "matrix-widget-api";
import { ErrorIcon } from "@vector-im/compound-design-tokens/assets/web/icons";

import BaseDialog from "./BaseDialog";
import { _t, getUserLanguage } from "../../../languageHandler";
import AccessibleButton, { type AccessibleButtonKind } from "../elements/AccessibleButton";
import { StopGapWidgetDriver } from "../../../stores/widgets/StopGapWidgetDriver";
import { MatrixClientPeg } from "../../../MatrixClientPeg";
import { OwnProfileStore } from "../../../stores/OwnProfileStore";
import { arrayFastClone } from "../../../utils/arrays";
import { ElementWidget } from "../../../stores/widgets/StopGapWidget";
import { ELEMENT_CLIENT_ID } from "../../../identifiers";
import ThemeWatcher, { ThemeWatcherEvent } from "../../../settings/watchers/ThemeWatcher";

interface IProps {
    widgetDefinition: IModalWidgetOpenRequestData;
    widgetRoomId?: string;
    sourceWidgetId: string;
    onFinished(success: true, data: IModalWidgetReturnData): void;
    onFinished(success?: false, data?: void): void;
}

interface IState {
    messaging?: ClientWidgetApi;
    disabledButtonIds: ModalButtonID[];
}

const MAX_BUTTONS = 3;

export default class ModalWidgetDialog extends React.PureComponent<IProps, IState> {
    private readonly widget: Widget;
    private readonly possibleButtons: ModalButtonID[];
    private appFrame = React.createRef<HTMLIFrameElement>();
    private readonly themeWatcher = new ThemeWatcher();

    public state: IState = {
        disabledButtonIds: (this.props.widgetDefinition.buttons || []).filter((b) => b.disabled).map((b) => b.id),
    };

    public constructor(props: IProps) {
        super(props);

        this.widget = new ElementWidget({
            ...this.props.widgetDefinition,
            creatorUserId: MatrixClientPeg.safeGet().getSafeUserId(),
            id: `modal_${this.props.sourceWidgetId}`,
        });
        this.possibleButtons = (this.props.widgetDefinition.buttons || []).map((b) => b.id);
    }

    public componentDidMount(): void {
        const driver = new StopGapWidgetDriver([], this.widget, WidgetKind.Modal, false);
        const messaging = new ClientWidgetApi(this.widget, this.appFrame.current!, driver);
        this.setState({ messaging });
    }

    public componentWillUnmount(): void {
        this.themeWatcher.off(ThemeWatcherEvent.Change, this.onThemeChange);
        this.themeWatcher.stop();
        if (!this.state.messaging) return;
        this.state.messaging.off("ready", this.onReady);
        this.state.messaging.off(`action:${WidgetApiFromWidgetAction.CloseModalWidget}`, this.onWidgetClose);
        this.state.messaging.stop();
    }

    private onReady = (): void => {
        this.themeWatcher.start();
        this.themeWatcher.on(ThemeWatcherEvent.Change, this.onThemeChange);
        // Theme may have changed while messaging was starting
        this.onThemeChange(this.themeWatcher.getEffectiveTheme());
        this.state.messaging?.sendWidgetConfig(this.props.widgetDefinition);
    };

    private onLoad = (): void => {
        if (!this.state.messaging) return;
        this.state.messaging.once("ready", this.onReady);
        this.state.messaging.on(`action:${WidgetApiFromWidgetAction.CloseModalWidget}`, this.onWidgetClose);
        this.state.messaging.on(`action:${WidgetApiFromWidgetAction.SetModalButtonEnabled}`, this.onButtonEnableToggle);
    };

    private onThemeChange = (theme: string): void => {
        this.state.messaging?.updateTheme({ name: theme });
    };

    private onWidgetClose = (ev: CustomEvent<IModalWidgetCloseRequest>): void => {
        this.props.onFinished(true, ev.detail.data);
    };

    private onButtonEnableToggle = (ev: CustomEvent<ISetModalButtonEnabledActionRequest>): void => {
        ev.preventDefault();
        const isClose = ev.detail.data.button === BuiltInModalButtonID.Close;
        if (isClose || !this.possibleButtons.includes(ev.detail.data.button)) {
            return this.state.messaging?.transport.reply(ev.detail, {
                error: { message: "Invalid button" },
            } as IWidgetApiErrorResponseData);
        }

        let buttonIds: ModalButtonID[];
        if (ev.detail.data.enabled) {
            buttonIds = arrayFastClone(this.state.disabledButtonIds).filter((i) => i !== ev.detail.data.button);
        } else {
            // use a set to swap the operation to avoid memory leaky arrays.
            const tempSet = new Set(this.state.disabledButtonIds);
            tempSet.add(ev.detail.data.button);
            buttonIds = Array.from(tempSet);
        }
        this.setState({ disabledButtonIds: buttonIds });
        this.state.messaging?.transport.reply(ev.detail, {} as IWidgetApiAcknowledgeResponseData);
    };

    public render(): React.ReactNode {
        const templated = this.widget.getCompleteUrl({
            widgetRoomId: this.props.widgetRoomId,
            currentUserId: MatrixClientPeg.safeGet().getSafeUserId(),
            userDisplayName: OwnProfileStore.instance.displayName ?? undefined,
            userHttpAvatarUrl: OwnProfileStore.instance.getHttpAvatarUrl() ?? undefined,
            clientId: ELEMENT_CLIENT_ID,
            clientTheme: this.themeWatcher.getEffectiveTheme(),
            clientLanguage: getUserLanguage(),
            baseUrl: MatrixClientPeg.safeGet().baseUrl,
        });

        const parsed = new URL(templated);

        // Add in some legacy support sprinkles (for non-popout widgets)
        // TODO: Replace these with proper widget params
        // See https://github.com/matrix-org/matrix-doc/pull/1958/files#r405714833
        parsed.searchParams.set("widgetId", this.widget.id);
        parsed.searchParams.set("parentUrl", window.location.href.split("#", 2)[0]);

        // Replace the encoded dollar signs back to dollar signs. They have no special meaning
        // in HTTP, but URL parsers encode them anyways.
        const widgetUrl = parsed.toString().replace(/%24/g, "$");

        let buttons;
        if (this.props.widgetDefinition.buttons) {
            // show first button rightmost for a more natural specification
            buttons = this.props.widgetDefinition.buttons
                .slice(0, MAX_BUTTONS)
                .reverse()
                .map((def) => {
                    let kind: AccessibleButtonKind = "secondary";
                    switch (def.kind) {
                        case ModalButtonKind.Primary:
                            kind = "primary";
                            break;
                        case ModalButtonKind.Secondary:
                            kind = "primary_outline";
                            break;
                        case ModalButtonKind.Danger:
                            kind = "danger";
                            break;
                    }

                    const onClick = (): void => {
                        this.state.messaging?.notifyModalWidgetButtonClicked(def.id);
                    };

                    const isDisabled = this.state.disabledButtonIds.includes(def.id);

                    return (
                        <AccessibleButton key={def.id} kind={kind} onClick={onClick} disabled={isDisabled}>
                            {def.label}
                        </AccessibleButton>
                    );
                });
        }

        return (
            <BaseDialog
                title={this.props.widgetDefinition.name || _t("widget|modal_title_default")}
                className="mx_ModalWidgetDialog"
                contentId="mx_Dialog_content"
                onFinished={this.props.onFinished}
            >
                <div className="mx_ModalWidgetDialog_warning">
                    <ErrorIcon width="16px" height="16px" />
                    {_t("widget|modal_data_warning", {
                        widgetDomain: parsed.hostname,
                    })}
                </div>
                <div>
                    <iframe
                        title={this.widget.name ?? undefined}
                        ref={this.appFrame}
                        sandbox="allow-forms allow-scripts allow-same-origin"
                        src={widgetUrl}
                        onLoad={this.onLoad}
                    />
                </div>
                <div className="mx_ModalWidgetDialog_buttons">{buttons}</div>
            </BaseDialog>
        );
    }
}
