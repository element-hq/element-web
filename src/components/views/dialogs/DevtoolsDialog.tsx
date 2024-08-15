/*
Copyright 2022 Michael Telatynski <7t3chguy@gmail.com>
Copyright 2018-2023 The Matrix.org Foundation C.I.C.

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

import React, { useState } from "react";

import { _t, _td, TranslationKey } from "../../../languageHandler";
import MatrixClientContext from "../../../contexts/MatrixClientContext";
import BaseDialog from "./BaseDialog";
import { TimelineEventEditor } from "./devtools/Event";
import ServersInRoom from "./devtools/ServersInRoom";
import VerificationExplorer from "./devtools/VerificationExplorer";
import SettingExplorer from "./devtools/SettingExplorer";
import { RoomStateExplorer } from "./devtools/RoomState";
import BaseTool, { DevtoolsContext, IDevtoolsProps } from "./devtools/BaseTool";
import WidgetExplorer from "./devtools/WidgetExplorer";
import { AccountDataExplorer, RoomAccountDataExplorer } from "./devtools/AccountData";
import SettingsFlag from "../elements/SettingsFlag";
import { SettingLevel } from "../../../settings/SettingLevel";
import ServerInfo from "./devtools/ServerInfo";
import { Features } from "../../../settings/Settings";
import CopyableText from "../elements/CopyableText";
import RoomNotifications from "./devtools/RoomNotifications";

enum Category {
    Room,
    Other,
}

const categoryLabels: Record<Category, TranslationKey> = {
    [Category.Room]: _td("devtools|category_room"),
    [Category.Other]: _td("devtools|category_other"),
};

export type Tool = React.FC<IDevtoolsProps> | ((props: IDevtoolsProps) => JSX.Element);
const Tools: Record<Category, [label: TranslationKey, tool: Tool][]> = {
    [Category.Room]: [
        [_td("devtools|send_custom_timeline_event"), TimelineEventEditor],
        [_td("devtools|explore_room_state"), RoomStateExplorer],
        [_td("devtools|explore_room_account_data"), RoomAccountDataExplorer],
        [_td("devtools|view_servers_in_room"), ServersInRoom],
        [_td("devtools|notifications_debug"), RoomNotifications],
        [_td("devtools|verification_explorer"), VerificationExplorer],
        [_td("devtools|active_widgets"), WidgetExplorer],
    ],
    [Category.Other]: [
        [_td("devtools|explore_account_data"), AccountDataExplorer],
        [_td("devtools|settings_explorer"), SettingExplorer],
        [_td("devtools|server_info"), ServerInfo],
    ],
};

interface IProps {
    roomId: string;
    threadRootId?: string | null;
    onFinished(finished?: boolean): void;
}

type ToolInfo = [label: TranslationKey, tool: Tool];

const DevtoolsDialog: React.FC<IProps> = ({ roomId, threadRootId, onFinished }) => {
    const [tool, setTool] = useState<ToolInfo | null>(null);

    let body: JSX.Element;
    let onBack: () => void;

    if (tool) {
        onBack = () => {
            setTool(null);
        };

        const Tool = tool[1];
        body = <Tool onBack={onBack} setTool={(label, tool) => setTool([label, tool])} />;
    } else {
        const onBack = (): void => {
            onFinished(false);
        };
        body = (
            <BaseTool onBack={onBack}>
                {Object.entries(Tools).map(([category, tools]) => (
                    <div key={category}>
                        <h3>{_t(categoryLabels[category as unknown as Category])}</h3>
                        {tools.map(([label, tool]) => {
                            const onClick = (): void => {
                                setTool([label, tool]);
                            };
                            return (
                                <button className="mx_DevTools_button" key={label} onClick={onClick}>
                                    {_t(label)}
                                </button>
                            );
                        })}
                    </div>
                ))}
                <div>
                    <h3>{_t("common|options")}</h3>
                    <SettingsFlag name="developerMode" level={SettingLevel.ACCOUNT} />
                    <SettingsFlag name="showHiddenEventsInTimeline" level={SettingLevel.DEVICE} />
                    <SettingsFlag name="enableWidgetScreenshots" level={SettingLevel.ACCOUNT} />
                    <SettingsFlag name={Features.VoiceBroadcastForceSmallChunks} level={SettingLevel.DEVICE} />
                </div>
            </BaseTool>
        );
    }

    const label = tool ? _t(tool[0]) : _t("devtools|toolbox");
    return (
        <BaseDialog className="mx_QuestionDialog" onFinished={onFinished} title={_t("devtools|developer_tools")}>
            <MatrixClientContext.Consumer>
                {(cli) => (
                    <>
                        <div className="mx_DevTools_label_left">{label}</div>
                        <CopyableText className="mx_DevTools_label_right" getTextToCopy={() => roomId} border={false}>
                            {_t("devtools|room_id", { roomId })}
                        </CopyableText>
                        {!threadRootId ? null : (
                            <CopyableText
                                className="mx_DevTools_label_right"
                                getTextToCopy={() => threadRootId}
                                border={false}
                            >
                                {_t("devtools|thread_root_id", { threadRootId })}
                            </CopyableText>
                        )}
                        <div className="mx_DevTools_label_bottom" />
                        {cli.getRoom(roomId) && (
                            <DevtoolsContext.Provider value={{ room: cli.getRoom(roomId)!, threadRootId }}>
                                {body}
                            </DevtoolsContext.Provider>
                        )}
                    </>
                )}
            </MatrixClientContext.Consumer>
        </BaseDialog>
    );
};

export default DevtoolsDialog;
