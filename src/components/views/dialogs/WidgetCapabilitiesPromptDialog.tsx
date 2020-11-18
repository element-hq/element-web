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

import React  from 'react';
import BaseDialog from "./BaseDialog";
import { _t, _td, TranslatedString } from "../../../languageHandler";
import { IDialogProps } from "./IDialogProps";
import { Capability, EventDirection, MatrixCapabilities, Widget, WidgetEventCapability } from "matrix-widget-api";
import { objectShallowClone } from "../../../utils/objects";
import { ElementWidgetCapabilities } from "../../../stores/widgets/ElementWidgetCapabilities";
import { EventType, MsgType } from "matrix-js-sdk/lib/@types/event";
import StyledCheckbox from "../elements/StyledCheckbox";
import DialogButtons from "../elements/DialogButtons";
import LabelledToggleSwitch from "../elements/LabelledToggleSwitch";

// TODO: These messaging things can probably get their own store of some sort
const SIMPLE_CAPABILITY_MESSAGES = {
    [MatrixCapabilities.AlwaysOnScreen]: _td("Remain on your screen while running"),
    [MatrixCapabilities.StickerSending]: _td("Send stickers into your active room"),
    [ElementWidgetCapabilities.CanChangeViewedRoom]: _td("Change which room you're viewing"),
};
const SEND_RECV_EVENT_CAPABILITY_MESSAGES = {
    [EventType.RoomTopic]: {
        // TODO: We probably want to say "this room" when we can
        [EventDirection.Send]: _td("Change the topic of your active room"),
        [EventDirection.Receive]: _td("See when the topic changes in your active room"),
    },
    [EventType.RoomName]: {
        [EventDirection.Send]: _td("Change the name of your active room"),
        [EventDirection.Receive]: _td("See when the name changes in your active room"),
    },
    [EventType.RoomAvatar]: {
        [EventDirection.Send]: _td("Change the avatar of your active room"),
        [EventDirection.Receive]: _td("See when the avatar changes in your active room"),
    },
    // TODO: Add more as needed
};
function textForEventCapabilitiy(cap: WidgetEventCapability): { primary: TranslatedString, byline: TranslatedString } {
    let primary: TranslatedString;
    let byline: TranslatedString;

    if (cap.isState) {
        byline = cap.keyStr
            ? _t("with state key %(stateKey)s", {stateKey: cap.keyStr})
            : _t("with an empty state key");
    }

    const srMessages = SEND_RECV_EVENT_CAPABILITY_MESSAGES[cap.eventType];
    if (srMessages && srMessages[cap.direction]) {
        primary = _t(srMessages[cap.direction]);
    } else {
        if (cap.eventType === EventType.RoomMessage) {
            if (cap.direction === EventDirection.Receive) {
                if (!cap.keyStr) {
                    primary = _t("See messages sent in your active room");
                } else {
                    if (cap.keyStr === MsgType.Text) {
                        primary = _t("See text messages sent in your active room");
                    } else if (cap.keyStr === MsgType.Emote) {
                        primary = _t("See emotes sent in your active room");
                    } else if (cap.keyStr === MsgType.Image) {
                        primary = _t("See images sent in your active room");
                    } else if (cap.keyStr === MsgType.Video) {
                        primary = _t("See videos sent in your active room");
                    } else if (cap.keyStr === MsgType.File) {
                        primary = _t("See general files sent in your active room");
                    } else {
                        primary = _t(
                            "See <code>%(msgtype)s</code> messages sent in your active room",
                            {msgtype: cap.keyStr}, {code: sub => <code>{sub}</code>},
                        );
                    }
                }
            } else {
                if (!cap.keyStr) {
                    primary = _t("Send messages as you in your active room");
                } else {
                    if (cap.keyStr === MsgType.Text) {
                        primary = _t("Send text messages as you in your active room");
                    } else if (cap.keyStr === MsgType.Emote) {
                        primary = _t("Send emotes as you in your active room");
                    } else if (cap.keyStr === MsgType.Image) {
                        primary = _t("Send images as you in your active room");
                    } else if (cap.keyStr === MsgType.Video) {
                        primary = _t("Send videos as you in your active room");
                    } else if (cap.keyStr === MsgType.File) {
                        primary = _t("Send general files as you in your active room");
                    } else {
                        primary = _t(
                            "Send <code>%(msgtype)s</code> messages as you in your active room",
                            {msgtype: cap.keyStr}, {code: sub => <code>{sub}</code>},
                        );
                    }
                }
            }
        } else {
            if (cap.direction === EventDirection.Receive) {
                primary = _t(
                    "See <code>%(eventType)s</code> events sent in your active room",
                    {eventType: cap.eventType}, {code: sub => <code>{sub}</code>},
                );
            } else {
                primary = _t(
                    "Send <code>%(eventType)s</code> events as you in your active room",
                    {eventType: cap.eventType}, {code: sub => <code>{sub}</code>},
                );
            }
        }
    }

    return {primary, byline};
}

export function getRememberedCapabilitiesForWidget(widget: Widget): Capability[] {
    return JSON.parse(localStorage.getItem(`widget_${widget.id}_approved_caps`) || "[]");
}

function setRememberedCapabilitiesForWidget(widget: Widget, caps: Capability[]) {
    localStorage.setItem(`widget_${widget.id}_approved_caps`, JSON.stringify(caps));
}

interface IProps extends IDialogProps {
    requestedCapabilities: Set<Capability>;
    widget: Widget;
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
            const evCap = this.eventPermissionsMap.get(cap);

            let text: TranslatedString;
            let byline: TranslatedString;
            if (evCap) {
                const t = textForEventCapabilitiy(evCap);
                text = t.primary;
                byline = t.byline;
            } else if (SIMPLE_CAPABILITY_MESSAGES[cap]) {
                text = _t(SIMPLE_CAPABILITY_MESSAGES[cap]);
            } else {
                text = _t(
                    "The <code>%(capability)s</code> capability",
                    {capability: cap}, {code: sub => <code>{sub}</code>},
                );
            }

            return (
                <div className="mx_WidgetCapabilitiesPromptDialog_cap">
                    <StyledCheckbox
                        key={cap + i}
                        checked={isChecked}
                        onChange={() => this.onToggle(cap)}
                    >{text}</StyledCheckbox>
                    {byline ? <span className="mx_WidgetCapabilitiesPromptDialog_byline">{byline}</span> : null}
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
                        {_t("This widget would like to:")}
                        {checkboxRows}
                        <LabelledToggleSwitch
                            value={this.state.rememberSelection}
                            toggleInFront={true}
                            onChange={this.onRememberSelectionChange}
                            label={_t("Remember my selection for this widget")} />
                        <DialogButtons
                            primaryButton={_t("Approve")}
                            cancelButton={_t("Decline All")}
                            onPrimaryButtonClick={this.onSubmit}
                            onCancel={this.onReject}
                        />
                    </div>
                </form>
            </BaseDialog>
        );
    }
}
