/*
Copyright 2024,2025 New Vector Ltd.
Copyright 2020, 2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import {
    type Capability,
    isTimelineCapability,
    type Widget,
    WidgetEventCapability,
    type WidgetKind,
} from "matrix-widget-api";
import { lexicographicCompare } from "matrix-js-sdk/src/utils";

import BaseDialog from "./BaseDialog";
import { _t } from "../../../languageHandler";
import { objectShallowClone } from "../../../utils/objects";
import StyledCheckbox from "../elements/StyledCheckbox";
import DialogButtons from "../elements/DialogButtons";
import LabelledToggleSwitch from "../elements/LabelledToggleSwitch";
import { CapabilityText } from "../../../widgets/CapabilityText";

interface IProps {
    requestedCapabilities: Set<Capability>;
    widget: Widget;
    widgetKind: WidgetKind; // TODO: Refactor into the Widget class
    onFinished(result?: { approved: Capability[]; remember: boolean }): void;
}

type BooleanStates = Partial<{
    [capability in Capability]: boolean;
}>;

interface IState {
    booleanStates: BooleanStates;
    rememberSelection: boolean;
}

export default class WidgetCapabilitiesPromptDialog extends React.PureComponent<IProps, IState> {
    private eventPermissionsMap = new Map<Capability, WidgetEventCapability>();

    public constructor(props: IProps) {
        super(props);

        const parsedEvents = WidgetEventCapability.findEventCapabilities(this.props.requestedCapabilities);
        parsedEvents.forEach((e) => this.eventPermissionsMap.set(e.raw, e));

        const states: BooleanStates = {};
        this.props.requestedCapabilities.forEach((c) => (states[c] = true));

        this.state = {
            booleanStates: states,
            rememberSelection: true,
        };
    }

    private onToggle = (capability: Capability): void => {
        const newStates = objectShallowClone(this.state.booleanStates);
        newStates[capability] = !newStates[capability];
        this.setState({ booleanStates: newStates });
    };

    private onRememberSelectionChange = (newVal: boolean): void => {
        this.setState({ rememberSelection: newVal });
    };

    private onSubmit = async (): Promise<void> => {
        this.closeAndTryRemember(
            Object.entries(this.state.booleanStates)
                .filter(([_, isSelected]) => isSelected)
                .map(([cap]) => cap),
        );
    };

    private onReject = async (): Promise<void> => {
        this.closeAndTryRemember([]); // nothing was approved
    };

    private closeAndTryRemember(approved: Capability[]): void {
        this.props.onFinished({ approved, remember: this.state.rememberSelection });
    }

    public render(): React.ReactNode {
        // We specifically order the timeline capabilities down to the bottom. The capability text
        // generation cares strongly about this.
        const orderedCapabilities = Object.entries(this.state.booleanStates).sort(([capA], [capB]) => {
            const isTimelineA = isTimelineCapability(capA);
            const isTimelineB = isTimelineCapability(capB);

            if (!isTimelineA && !isTimelineB) return lexicographicCompare(capA, capB);
            if (isTimelineA && !isTimelineB) return 1;
            if (!isTimelineA && isTimelineB) return -1;
            if (isTimelineA && isTimelineB) return lexicographicCompare(capA, capB);

            return 0;
        });
        const checkboxRows = orderedCapabilities.map(([cap, isChecked], i) => {
            const text = CapabilityText.for(cap, this.props.widgetKind);

            return (
                <div className="mx_WidgetCapabilitiesPromptDialog_cap" key={cap + i}>
                    <StyledCheckbox checked={isChecked} onChange={() => this.onToggle(cap)} description={text.byline}>
                        {text.primary}
                    </StyledCheckbox>
                </div>
            );
        });

        return (
            <BaseDialog
                className="mx_WidgetCapabilitiesPromptDialog"
                onFinished={this.props.onFinished}
                title={_t("widget|capabilities_dialog|title")}
            >
                <form onSubmit={this.onSubmit}>
                    <div className="mx_Dialog_content">
                        <div className="text-muted">{_t("widget|capabilities_dialog|content_starting_text")}</div>
                        {checkboxRows}
                        <DialogButtons
                            primaryButton={_t("action|approve")}
                            cancelButton={_t("widget|capabilities_dialog|decline_all_permission")}
                            onPrimaryButtonClick={this.onSubmit}
                            onCancel={this.onReject}
                            additive={
                                <LabelledToggleSwitch
                                    value={this.state.rememberSelection}
                                    toggleInFront={true}
                                    onChange={this.onRememberSelectionChange}
                                    label={_t("widget|capabilities_dialog|remember_Selection")}
                                />
                            }
                        />
                    </div>
                </form>
            </BaseDialog>
        );
    }
}
