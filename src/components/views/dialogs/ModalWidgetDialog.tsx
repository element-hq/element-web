/*
Copyright 2020 The Matrix.org Foundation C.I.C.

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

import * as React from 'react';
import BaseDialog from './BaseDialog';
import { _t } from '../../../languageHandler';
import AccessibleButton from "../elements/AccessibleButton";
import {
    ClientWidgetApi,
    IModalWidgetCloseRequest,
    IModalWidgetOpenRequestData,
    IModalWidgetReturnData,
    ISetModalButtonEnabledActionRequest,
    IWidgetApiAcknowledgeResponseData,
    IWidgetApiErrorResponseData,
    BuiltInModalButtonID,
    ModalButtonID,
    ModalButtonKind,
    Widget,
    WidgetApiFromWidgetAction,
    WidgetKind,
} from "matrix-widget-api";
import {StopGapWidgetDriver} from "../../../stores/widgets/StopGapWidgetDriver";
import {MatrixClientPeg} from "../../../MatrixClientPeg";
import RoomViewStore from "../../../stores/RoomViewStore";
import {OwnProfileStore} from "../../../stores/OwnProfileStore";
import { arrayFastClone } from "../../../utils/arrays";
import { ElementWidget } from "../../../stores/widgets/StopGapWidget";

interface IProps {
    widgetDefinition: IModalWidgetOpenRequestData;
    sourceWidgetId: string;
    onFinished(success: boolean, data?: IModalWidgetReturnData): void;
}

interface IState {
    messaging?: ClientWidgetApi;
    disabledButtonIds: ModalButtonID[];
}

const MAX_BUTTONS = 3;

export default class ModalWidgetDialog extends React.PureComponent<IProps, IState> {
    private readonly widget: Widget;
    private readonly possibleButtons: ModalButtonID[];
    private appFrame: React.RefObject<HTMLIFrameElement> = React.createRef();

    state: IState = {
        disabledButtonIds: [],
    };

    constructor(props) {
        super(props);

        this.widget = new ElementWidget({
            ...this.props.widgetDefinition,
            creatorUserId: MatrixClientPeg.get().getUserId(),
            id: `modal_${this.props.sourceWidgetId}`,
        });
        this.possibleButtons = (this.props.widgetDefinition.buttons || []).map(b => b.id);
    }

    public componentDidMount() {
        const driver = new StopGapWidgetDriver( [], this.widget, WidgetKind.Modal);
        const messaging = new ClientWidgetApi(this.widget, this.appFrame.current, driver);
        this.setState({messaging});
    }

    public componentWillUnmount() {
        this.state.messaging.off("ready", this.onReady);
        this.state.messaging.off(`action:${WidgetApiFromWidgetAction.CloseModalWidget}`, this.onWidgetClose);
        this.state.messaging.stop();
    }

    private onReady = () => {
        this.state.messaging.sendWidgetConfig(this.props.widgetDefinition);
    };

    private onLoad = () => {
        this.state.messaging.once("ready", this.onReady);
        this.state.messaging.on(`action:${WidgetApiFromWidgetAction.CloseModalWidget}`, this.onWidgetClose);
        this.state.messaging.on(`action:${WidgetApiFromWidgetAction.SetModalButtonEnabled}`, this.onButtonEnableToggle);
    };

    private onWidgetClose = (ev: CustomEvent<IModalWidgetCloseRequest>) => {
        this.props.onFinished(true, ev.detail.data);
    }

    private onButtonEnableToggle = (ev: CustomEvent<ISetModalButtonEnabledActionRequest>) => {
        ev.preventDefault();
        const isClose = ev.detail.data.button === BuiltInModalButtonID.Close;
        if (isClose || !this.possibleButtons.includes(ev.detail.data.button)) {
            return this.state.messaging.transport.reply(ev.detail, {
                error: {message: "Invalid button"},
            } as IWidgetApiErrorResponseData);
        }

        let buttonIds: ModalButtonID[];
        if (ev.detail.data.enabled) {
            buttonIds = arrayFastClone(this.state.disabledButtonIds).filter(i => i !== ev.detail.data.button);
        } else {
            // use a set to swap the operation to avoid memory leaky arrays.
            const tempSet = new Set(this.state.disabledButtonIds);
            tempSet.add(ev.detail.data.button);
            buttonIds = Array.from(tempSet);
        }
        this.setState({disabledButtonIds: buttonIds});
        this.state.messaging.transport.reply(ev.detail, {} as IWidgetApiAcknowledgeResponseData);
    };

    public render() {
        const templated = this.widget.getCompleteUrl({
            currentRoomId: RoomViewStore.getRoomId(),
            currentUserId: MatrixClientPeg.get().getUserId(),
            userDisplayName: OwnProfileStore.instance.displayName,
            userHttpAvatarUrl: OwnProfileStore.instance.getHttpAvatarUrl(),
        });

        const parsed = new URL(templated);

        // Add in some legacy support sprinkles (for non-popout widgets)
        // TODO: Replace these with proper widget params
        // See https://github.com/matrix-org/matrix-doc/pull/1958/files#r405714833
        parsed.searchParams.set('widgetId', this.widget.id);
        parsed.searchParams.set('parentUrl', window.location.href.split('#', 2)[0]);

        // Replace the encoded dollar signs back to dollar signs. They have no special meaning
        // in HTTP, but URL parsers encode them anyways.
        const widgetUrl = parsed.toString().replace(/%24/g, '$');

        let buttons;
        if (this.props.widgetDefinition.buttons) {
            // show first button rightmost for a more natural specification
            buttons = this.props.widgetDefinition.buttons.slice(0, MAX_BUTTONS).reverse().map(def => {
                let kind = "secondary";
                switch (def.kind) {
                    case ModalButtonKind.Primary:
                        kind = "primary";
                        break;
                    case ModalButtonKind.Secondary:
                        kind = "primary_outline";
                        break
                    case ModalButtonKind.Danger:
                        kind = "danger";
                        break;
                }

                const onClick = () => {
                    this.state.messaging.notifyModalWidgetButtonClicked(def.id);
                };

                const isDisabled = this.state.disabledButtonIds.includes(def.id);

                return <AccessibleButton key={def.id} kind={kind} onClick={onClick} disabled={isDisabled}>
                    { def.label }
                </AccessibleButton>;
            });
        }

        return <BaseDialog
            title={this.props.widgetDefinition.name || _t("Modal Widget")}
            className="mx_ModalWidgetDialog"
            contentId="mx_Dialog_content"
            onFinished={this.props.onFinished}
        >
            <div className="mx_ModalWidgetDialog_warning">
                <img
                    src={require("../../../../res/img/element-icons/warning-badge.svg")}
                    height="16"
                    width="16"
                    alt=""
                />
                {_t("Data on this screen is shared with %(widgetDomain)s", {
                    widgetDomain: parsed.hostname,
                })}
            </div>
            <div>
                <iframe
                    ref={this.appFrame}
                    sandbox="allow-forms allow-scripts allow-same-origin"
                    src={widgetUrl}
                    onLoad={this.onLoad}
                />
            </div>
            <div className="mx_ModalWidgetDialog_buttons">
                { buttons }
            </div>
        </BaseDialog>;
    }
}
