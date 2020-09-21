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
import { IDialogProps } from "./IDialogProps";
import WidgetMessaging from "../../../WidgetMessaging";
import LabelledToggleSwitch from "../elements/LabelledToggleSwitch";
import Field from "../elements/Field";
import { KnownWidgetActions } from "../../../widgets/WidgetApi";
import ActiveWidgetStore from "../../../stores/ActiveWidgetStore";

interface IState {
    messaging?: WidgetMessaging;

    androidMode: boolean;
    darkTheme: boolean;
    accentColor: string;
}

interface IProps extends IDialogProps {
    widgetDefinition: {url: string, data: any};
    sourceWidgetId: string;
}

// TODO: Make a better dialog

export default class TempWidgetDialog extends React.PureComponent<IProps, IState> {
    private appFrame: React.RefObject<HTMLIFrameElement> = React.createRef();

    constructor(props) {
        super(props);
        this.state = {
            androidMode: false,
            darkTheme: false,
            accentColor: "#03b381",
        };
    }

    public componentDidMount() {
        // TODO: Don't violate every principle of widget creation
        const messaging = new WidgetMessaging(
            "TEMP_ID",
            this.props.widgetDefinition.url,
            this.props.widgetDefinition.url,
            false,
            this.appFrame.current.contentWindow,
        );
        this.setState({messaging});
    }

    public componentWillUnmount() {
        this.state.messaging.fromWidget.removeListener(KnownWidgetActions.CloseWidget, this.onWidgetClose);
        this.state.messaging.stop();
    }

    private onLoad = () => {
        this.state.messaging.getCapabilities().then(caps => {
            console.log("Requested capabilities: ", caps);
            this.sendTheme();
            this.state.messaging.sendWidgetConfig(this.props.widgetDefinition.data);
        });
        this.state.messaging.fromWidget.addListener(KnownWidgetActions.CloseWidget, this.onWidgetClose);
    };

    private sendTheme() {
        if (!this.state.messaging) return;
        this.state.messaging.sendThemeInfo({
            clientName: this.state.androidMode ? "element-android" : "element-web",
            isDark: this.state.darkTheme,
            accentColor: this.state.accentColor,
        });
    }

    public static sendExitData(sourceWidgetId: string, success: boolean, data?: any) {
        const sourceMessaging = ActiveWidgetStore.getWidgetMessaging(sourceWidgetId);
        if (!sourceMessaging) {
            console.error("No source widget messaging for temp widget");
            return;
        }
        sourceMessaging.sendTempCloseInfo({success, ...data});
    }

    private onWidgetClose = (req) => {
        this.props.onFinished(true);
        TempWidgetDialog.sendExitData(this.props.sourceWidgetId, true, req.data);
    }

    private onClientToggleChanged = (androidMode) => {
        this.setState({androidMode}, () => this.sendTheme());
    };

    private onDarkThemeChanged = (darkTheme) => {
        this.setState({darkTheme}, () => this.sendTheme());
    };

    private onAccentColorChanged = (ev) => {
        this.setState({accentColor: ev.target.value}, () => this.sendTheme());
    };

    public render() {
        // TODO: Don't violate every single security principle

        const widgetUrl = this.props.widgetDefinition.url
            + "?widgetId=TEMP_ID&parentUrl=" + encodeURIComponent(window.location.href);

        return <BaseDialog
            title={_t("Widget Proof of Concept Dashboard")}
            className='mx_TempWidgetDialog'
            contentId='mx_Dialog_content'
            onFinished={this.props.onFinished}
            hasCancel={false}
        >
            <div>
                <LabelledToggleSwitch
                    label={ _t("Look like Android")}
                    onChange={this.onClientToggleChanged}
                    value={this.state.androidMode}
                />
                <LabelledToggleSwitch
                    label={ _t("Look like dark theme")}
                    onChange={this.onDarkThemeChanged}
                    value={this.state.darkTheme}
                />
                <Field
                    value={this.state.accentColor}
                    label={_t('Accent Colour')}
                    onChange={this.onAccentColorChanged}
                />
            </div>
            <div>
                <iframe
                    ref={this.appFrame}
                    width={700} height={450}
                    src={widgetUrl}
                    onLoad={this.onLoad}
                />
            </div>
        </BaseDialog>;
    }
}
