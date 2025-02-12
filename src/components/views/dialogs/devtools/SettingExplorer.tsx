/*
Copyright 2024 New Vector Ltd.
Copyright 2018-2023 The Matrix.org Foundation C.I.C.
Copyright 2022 Michael Telatynski <7t3chguy@gmail.com>

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type ChangeEvent, useContext, useMemo, useState } from "react";
import { logger } from "matrix-js-sdk/src/logger";

import { _t, _td } from "../../../../languageHandler";
import BaseTool, { DevtoolsContext, type IDevtoolsProps } from "./BaseTool";
import AccessibleButton from "../../elements/AccessibleButton";
import SettingsStore, { LEVEL_ORDER } from "../../../../settings/SettingsStore";
import { type SettingLevel } from "../../../../settings/SettingLevel";
import { type SettingKey, SETTINGS, type SettingValueType } from "../../../../settings/Settings";
import Field from "../../elements/Field";

const SettingExplorer: React.FC<IDevtoolsProps> = ({ onBack }) => {
    const [setting, setSetting] = useState<SettingKey | null>(null);
    const [editing, setEditing] = useState(false);

    if (setting && editing) {
        const onBack = (): void => {
            setEditing(false);
        };
        return <EditSetting setting={setting} onBack={onBack} />;
    } else if (setting) {
        const onBack = (): void => {
            setSetting(null);
        };
        const onEdit = async (): Promise<void> => {
            setEditing(true);
        };
        return <ViewSetting setting={setting} onBack={onBack} onEdit={onEdit} />;
    } else {
        const onView = (setting: SettingKey): void => {
            setSetting(setting);
        };
        const onEdit = (setting: SettingKey): void => {
            setSetting(setting);
            setEditing(true);
        };
        return <SettingsList onBack={onBack} onView={onView} onEdit={onEdit} />;
    }
};

export default SettingExplorer;

interface ICanEditLevelFieldProps {
    setting: SettingKey;
    level: SettingLevel;
    roomId?: string;
}

const CanEditLevelField: React.FC<ICanEditLevelFieldProps> = ({ setting, roomId, level }) => {
    const canEdit = SettingsStore.canSetValue(setting, roomId ?? null, level);
    const className = canEdit ? "mx_DevTools_SettingsExplorer_mutable" : "mx_DevTools_SettingsExplorer_immutable";
    return (
        <td className={className}>
            <code>{canEdit.toString()}</code>
        </td>
    );
};

function renderExplicitSettingValues(setting: SettingKey, roomId?: string): string {
    const vals: Record<string, SettingValueType> = {};
    for (const level of LEVEL_ORDER) {
        try {
            vals[level] = SettingsStore.getValueAt(level, setting, roomId, true, true);
            if (vals[level] === undefined) {
                vals[level] = null;
            }
        } catch (e) {
            logger.warn(e);
        }
    }
    return JSON.stringify(vals, null, 4);
}

interface IEditSettingProps extends Pick<IDevtoolsProps, "onBack"> {
    setting: SettingKey;
}

const EditSetting: React.FC<IEditSettingProps> = ({ setting, onBack }) => {
    const context = useContext(DevtoolsContext);
    const [explicitValue, setExplicitValue] = useState(renderExplicitSettingValues(setting));
    const [explicitRoomValue, setExplicitRoomValue] = useState(
        renderExplicitSettingValues(setting, context.room.roomId),
    );

    const onSave = async (): Promise<string | undefined> => {
        try {
            const parsedExplicit = JSON.parse(explicitValue);
            const parsedExplicitRoom = JSON.parse(explicitRoomValue);
            for (const level of Object.keys(parsedExplicit)) {
                logger.log(`[Devtools] Setting value of ${setting} at ${level} from user input`);
                try {
                    const val = parsedExplicit[level];
                    await SettingsStore.setValue(setting, null, level as SettingLevel, val);
                } catch (e) {
                    logger.warn(e);
                }
            }

            const roomId = context.room.roomId;
            for (const level of Object.keys(parsedExplicit)) {
                logger.log(`[Devtools] Setting value of ${setting} at ${level} in ${roomId} from user input`);
                try {
                    const val = parsedExplicitRoom[level];
                    await SettingsStore.setValue(setting, roomId, level as SettingLevel, val);
                } catch (e) {
                    logger.warn(e);
                }
            }
            onBack();
        } catch (e) {
            return _t("devtools|failed_to_save") + (e instanceof Error ? ` (${e.message})` : "");
        }
    };

    return (
        <BaseTool onBack={onBack} actionLabel={_td("devtools|save_setting_values")} onAction={onSave}>
            <h3>
                {_t("devtools|setting_colon")} <code>{setting}</code>
            </h3>

            <div className="mx_DevTools_SettingsExplorer_warning">
                <strong>{_t("devtools|caution_colon")}</strong> {_t("devtools|use_at_own_risk")}
            </div>

            <div>
                {_t("devtools|setting_definition")}
                <pre>
                    <code>{JSON.stringify(SETTINGS[setting], null, 4)}</code>
                </pre>
            </div>

            <div>
                <table>
                    <thead>
                        <tr>
                            <th>{_t("devtools|level")}</th>
                            <th>{_t("devtools|settable_global")}</th>
                            <th>{_t("devtools|settable_room")}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {LEVEL_ORDER.map((lvl) => (
                            <tr key={lvl}>
                                <td>
                                    <code>{lvl}</code>
                                </td>
                                <CanEditLevelField setting={setting} level={lvl} />
                                <CanEditLevelField setting={setting} roomId={context.room.roomId} level={lvl} />
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div>
                <Field
                    id="valExpl"
                    label={_t("devtools|values_explicit")}
                    type="text"
                    className="mx_DevTools_textarea"
                    element="textarea"
                    autoComplete="off"
                    value={explicitValue}
                    onChange={(e) => setExplicitValue(e.target.value)}
                />
            </div>

            <div>
                <Field
                    id="valExpl"
                    label={_t("devtools|values_explicit_room")}
                    type="text"
                    className="mx_DevTools_textarea"
                    element="textarea"
                    autoComplete="off"
                    value={explicitRoomValue}
                    onChange={(e) => setExplicitRoomValue(e.target.value)}
                />
            </div>
        </BaseTool>
    );
};

interface IViewSettingProps extends Pick<IDevtoolsProps, "onBack"> {
    setting: SettingKey;
    onEdit(): Promise<void>;
}

const ViewSetting: React.FC<IViewSettingProps> = ({ setting, onEdit, onBack }) => {
    const context = useContext(DevtoolsContext);

    return (
        <BaseTool onBack={onBack} actionLabel={_td("devtools|edit_values")} onAction={onEdit}>
            <h3>
                {_t("devtools|setting_colon")} <code>{setting}</code>
            </h3>

            <div>
                {_t("devtools|setting_definition")}
                <pre>
                    <code>{JSON.stringify(SETTINGS[setting], null, 4)}</code>
                </pre>
            </div>

            <div>
                {_t("devtools|value_colon")}&nbsp;
                <code>{renderSettingValue(SettingsStore.getValue(setting))}</code>
            </div>

            <div>
                {_t("devtools|value_this_room_colon")}&nbsp;
                <code>{renderSettingValue(SettingsStore.getValue(setting, context.room.roomId))}</code>
            </div>

            <div>
                {_t("devtools|values_explicit_colon")}
                <pre>
                    <code>{renderExplicitSettingValues(setting)}</code>
                </pre>
            </div>

            <div>
                {_t("devtools|values_explicit_this_room_colon")}
                <pre>
                    <code>{renderExplicitSettingValues(setting, context.room.roomId)}</code>
                </pre>
            </div>
        </BaseTool>
    );
};

function renderSettingValue(val: any): string {
    // Note: we don't .toString() a string because we want JSON.stringify to inject quotes for us
    const toStringTypes = ["boolean", "number"];
    if (toStringTypes.includes(typeof val)) {
        return val.toString();
    } else {
        return JSON.stringify(val);
    }
}

interface ISettingsListProps extends Pick<IDevtoolsProps, "onBack"> {
    onView(setting: string): void;
    onEdit(setting: string): void;
}

const SettingsList: React.FC<ISettingsListProps> = ({ onBack, onView, onEdit }) => {
    const context = useContext(DevtoolsContext);
    const [query, setQuery] = useState("");

    const allSettings = useMemo(() => {
        let allSettings = Object.keys(SETTINGS) as SettingKey[];
        if (query) {
            const lcQuery = query.toLowerCase();
            allSettings = allSettings.filter((setting) => setting.toLowerCase().includes(lcQuery));
        }
        return allSettings;
    }, [query]);

    return (
        <BaseTool onBack={onBack} className="mx_DevTools_SettingsExplorer">
            <Field
                label={_t("common|filter_results")}
                autoFocus={true}
                size={64}
                type="text"
                autoComplete="off"
                value={query}
                onChange={(ev: ChangeEvent<HTMLInputElement>) => setQuery(ev.target.value)}
                className="mx_TextInputDialog_input mx_DevTools_RoomStateExplorer_query"
            />
            <table>
                <thead>
                    <tr>
                        <th>{_t("devtools|setting_id")}</th>
                        <th>{_t("devtools|value")}</th>
                        <th>{_t("devtools|value_in_this_room")}</th>
                    </tr>
                </thead>
                <tbody>
                    {allSettings.map((i) => (
                        <tr key={i}>
                            <td>
                                <AccessibleButton
                                    kind="link_inline"
                                    className="mx_DevTools_SettingsExplorer_setting"
                                    onClick={() => onView(i)}
                                >
                                    <code>{i}</code>
                                </AccessibleButton>
                                <AccessibleButton
                                    title={_t("devtools|edit_setting")}
                                    onClick={() => onEdit(i)}
                                    className="mx_DevTools_SettingsExplorer_edit"
                                >
                                    ✏
                                </AccessibleButton>
                            </td>
                            <td>
                                <code>{renderSettingValue(SettingsStore.getValue(i))}</code>
                            </td>
                            <td>
                                <code>{renderSettingValue(SettingsStore.getValue(i, context.room.roomId))}</code>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </BaseTool>
    );
};
