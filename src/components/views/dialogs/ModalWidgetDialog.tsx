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
import WidgetMessaging from "../../../WidgetMessaging";
import {ButtonKind, IButton, KnownWidgetActions} from "../../../widgets/WidgetApi";
import AccessibleButton from "../elements/AccessibleButton";

interface IModalWidget {
    type: string;
    url: string;
    name: string;
    data: any;
    waitForIframeLoad?: boolean;
    buttons?: IButton[];
}

interface IProps {
    widgetDefinition: IModalWidget;
    sourceWidgetId: string;
    onFinished(success: boolean, data?: any): void;
}

interface IState {
    messaging?: WidgetMessaging;
}

const MAX_BUTTONS = 3;

export default class ModalWidgetDialog extends React.PureComponent<IProps, IState> {
    private appFrame: React.RefObject<HTMLIFrameElement> = React.createRef();

    state: IState = {};

    private getWidgetId() {
        return `modal_${this.props.sourceWidgetId}`;
    }

    public componentDidMount() {
        // TODO: Don't violate every principle of widget creation
        const messaging = new WidgetMessaging(
            this.getWidgetId(),
            this.props.widgetDefinition.url,
            this.props.widgetDefinition.url, // TODO templating and such
            true,
            this.appFrame.current.contentWindow,
        );
        this.setState({messaging});
    }

    public componentWillUnmount() {
        this.state.messaging.fromWidget.removeListener(KnownWidgetActions.CloseModalWidget, this.onWidgetClose);
        this.state.messaging.stop();
    }

    private onLoad = () => {
        this.state.messaging.getCapabilities().then(caps => {
            console.log("Requested capabilities: ", caps);
            this.state.messaging.sendWidgetConfig(this.props.widgetDefinition.data);
        });
        this.state.messaging.fromWidget.addListener(KnownWidgetActions.CloseModalWidget, this.onWidgetClose);
    };

    private onWidgetClose = (req) => {
        this.props.onFinished(true, req.data);
    }

    public render() {
        // TODO: Don't violate every single security principle

        const widgetUrl = this.props.widgetDefinition.url
            + `?widgetId=${this.getWidgetId()}&parentUrl=${encodeURIComponent(window.location.href)}`;

        let buttons;
        if (this.props.widgetDefinition.buttons) {
            // show first button rightmost for a more natural specification
            buttons = this.props.widgetDefinition.buttons.slice(0, MAX_BUTTONS).reverse().map(def => {
                let kind = "secondary";
                switch (def.kind) {
                    case ButtonKind.Primary:
                        kind = "primary";
                        break;
                    case ButtonKind.Secondary:
                        kind = "primary_outline";
                        break
                    case ButtonKind.Danger:
                        kind = "danger";
                        break;
                }

                const onClick = () => {
                    this.state.messaging.sendModalButtonClicked(def.id);
                };

                return <AccessibleButton key={def.id} kind={kind} onClick={onClick}>
                    { def.label }
                </AccessibleButton>;
            });
        }

        return <BaseDialog
            title={this.props.widgetDefinition.name || _t("Modal Widget")}
            className="mx_ModalWidgetDialog"
            contentId="mx_Dialog_content"
            onFinished={this.props.onFinished}
            hasCancel={false}
        >
            <div>
                <iframe
                    ref={this.appFrame}
                    sandbox="allow-forms allow-scripts"
                    width={700} // TODO
                    height={450} // TODO
                    src={widgetUrl}
                    onLoad={this.onLoad}
                />
            </div>
            <div className="mx_ModalWidgetDialog_buttons" style={{float: "right"}}>
                { buttons }
            </div>
        </BaseDialog>;
    }
}
