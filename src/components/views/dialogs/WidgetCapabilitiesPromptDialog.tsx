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

import React from 'react';
import BaseDialog from "./BaseDialog";
import { _t } from "../../../languageHandler";
import { IDialogProps } from "./IDialogProps";
import {
    Capability,
    Widget,
    WidgetEventCapability,
    WidgetKind,
} from "matrix-widget-api";
import { objectShallowClone } from "../../../utils/objects";
import StyledCheckbox from "../elements/StyledCheckbox";
import DialogButtons from "../elements/DialogButtons";
import LabelledToggleSwitch from "../elements/LabelledToggleSwitch";
import { CapabilityText } from "../../../widgets/CapabilityText";

export function getRememberedCapabilitiesForWidget(widget: Widget): Capability[] {
    return JSON.parse(localStorage.getItem(`widget_${widget.id}_approved_caps`) || "[]");
}

function setRememberedCapabilitiesForWidget(widget: Widget, caps: Capability[]) {
    localStorage.setItem(`widget_${widget.id}_approved_caps`, JSON.stringify(caps));
}

interface IProps extends IDialogProps {
    requestedCapabilities: Set<Capability>;
    widget: Widget;
    widgetKind: WidgetKind; // TODO: Refactor into the Widget class
}

interface IBooleanStates {
    // @ts-ignore - TS wants a string key, but we know better
    [capability: Capability]: boolean;
}

interface IState {
    booleanStates: IBooleanStates;
    rememberSelection: boolean;
}

export default class WidgetCapabilitiesPromptDialog extends React.PureComponent<IProps, IState> {
    private eventPermissionsMap = new Map<Capability, WidgetEventCapability>();

    constructor(props: IProps) {
        super(props);

        const parsedEvents = WidgetEventCapability.findEventCapabilities(this.props.requestedCapabilities);
        parsedEvents.forEach(e => this.eventPermissionsMap.set(e.raw, e));

        const states: IBooleanStates = {};
        this.props.requestedCapabilities.forEach(c => states[c] = true);

        this.state = {
            booleanStates: states,
            rememberSelection: true,
        };
    }

    private onToggle = (capability: Capability) => {
        const newStates = objectShallowClone(this.state.booleanStates);
        newStates[capability] = !newStates[capability];
        this.setState({booleanStates: newStates});
    };

    private onRememberSelectionChange = (newVal: boolean) => {
        this.setState({rememberSelection: newVal});
    };

    private onSubmit = async (ev) => {
        this.closeAndTryRemember(Object.entries(this.state.booleanStates)
            .filter(([_, isSelected]) => isSelected)
            .map(([cap]) => cap));
    };

    private onReject = async (ev) => {
        this.closeAndTryRemember([]); // nothing was approved
    };

    private closeAndTryRemember(approved: Capability[]) {
        if (this.state.rememberSelection) {
            setRememberedCapabilitiesForWidget(this.props.widget, approved);
        }
        this.props.onFinished({approved});
    }

    public render() {
        const checkboxRows = Object.entries(this.state.booleanStates).map(([cap, isChecked], i) => {
            const text = CapabilityText.for(cap, this.props.widgetKind);
            const byline = text.byline
                ? <span className="mx_WidgetCapabilitiesPromptDialog_byline">{text.byline}</span>
                : null;

            return (
                <div className="mx_WidgetCapabilitiesPromptDialog_cap" key={cap + i}>
                    <StyledCheckbox
                        checked={isChecked}
                        onChange={() => this.onToggle(cap)}
                    >{text.primary}</StyledCheckbox>
                    {byline}
                </div>
            );
        });

        return (
            <BaseDialog
                className="mx_WidgetCapabilitiesPromptDialog"
                onFinished={this.props.onFinished}
                title={_t("Approve widget permissions")}
            >
                <form onSubmit={this.onSubmit}>
                    <div className="mx_Dialog_content">
                        <div className="text-muted">{_t("This widget would like to:")}</div>
                        {checkboxRows}
                        <DialogButtons
                            primaryButton={_t("Approve")}
                            cancelButton={_t("Decline All")}
                            onPrimaryButtonClick={this.onSubmit}
                            onCancel={this.onReject}
                            additive={
                                <LabelledToggleSwitch
                                    value={this.state.rememberSelection}
                                    toggleInFront={true}
                                    onChange={this.onRememberSelectionChange}
                                    label={_t("Remember my selection for this widget")} />}
                        />
                    </div>
                </form>
            </BaseDialog>
        );
    }
}
