/*
Copyright 2022 The Matrix.org Foundation C.I.C.

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

import { without } from "lodash";
import React, { useCallback, useEffect, useState } from "react";
import { MatrixError } from "matrix-js-sdk/src/matrix";

import { MenuItemRadio } from "../../../accessibility/context_menu/MenuItemRadio";
import { _t } from "../../../languageHandler";
import { MatrixClientPeg } from "../../../MatrixClientPeg";
import Modal from "../../../Modal";
import SdkConfig from "../../../SdkConfig";
import { SettingLevel } from "../../../settings/SettingLevel";
import SettingsStore from "../../../settings/SettingsStore";
import { Protocols } from "../../../utils/DirectoryUtils";
import { GenericDropdownMenu, GenericDropdownMenuItem } from "../../structures/GenericDropdownMenu";
import TextInputDialog from "../dialogs/TextInputDialog";
import AccessibleButton from "../elements/AccessibleButton";
import withValidation from "../elements/Validation";

const SETTING_NAME = "room_directory_servers";

export interface IPublicRoomDirectoryConfig {
    roomServer: string;
    instanceId?: string;
}

const validServer = withValidation<undefined, { error?: unknown }>({
    deriveData: async ({ value }): Promise<{ error?: unknown }> => {
        try {
            // check if we can successfully load this server's room directory
            await MatrixClientPeg.safeGet().publicRooms({
                limit: 1,
                server: value ?? undefined,
            });
            return {};
        } catch (error) {
            return { error };
        }
    },
    rules: [
        {
            key: "required",
            test: async ({ value }) => !!value,
            invalid: () => _t("spotlight|public_rooms|network_dropdown_required_invalid"),
        },
        {
            key: "available",
            final: true,
            test: async (_, { error }) => !error,
            valid: () => _t("spotlight|public_rooms|network_dropdown_available_valid"),
            invalid: ({ error }) =>
                error instanceof MatrixError && error.errcode === "M_FORBIDDEN"
                    ? _t("spotlight|public_rooms|network_dropdown_available_invalid_forbidden")
                    : _t("spotlight|public_rooms|network_dropdown_available_invalid"),
        },
    ],
    memoize: true,
});

function useSettingsValueWithSetter<T>(
    settingName: string,
    level: SettingLevel,
    roomId: string | null = null,
    excludeDefault = false,
): [T, (value: T) => Promise<void>] {
    const [value, setValue] = useState(SettingsStore.getValue<T>(settingName, roomId ?? undefined, excludeDefault));
    const setter = useCallback(
        async (value: T): Promise<void> => {
            setValue(value);
            SettingsStore.setValue(settingName, roomId, level, value);
        },
        [level, roomId, settingName],
    );

    useEffect(() => {
        const ref = SettingsStore.watchSetting(settingName, roomId, () => {
            setValue(SettingsStore.getValue<T>(settingName, roomId, excludeDefault));
        });
        // clean-up
        return () => {
            SettingsStore.unwatchSetting(ref);
        };
    }, [settingName, roomId, excludeDefault]);

    return [value, setter];
}

interface ServerList {
    allServers: string[];
    homeServer: string;
    userDefinedServers: string[];
    setUserDefinedServers: (servers: string[]) => void;
}

function removeAll<T>(target: Set<T>, ...toRemove: T[]): void {
    for (const value of toRemove) {
        target.delete(value);
    }
}

function useServers(): ServerList {
    const [userDefinedServers, setUserDefinedServers] = useSettingsValueWithSetter<string[]>(
        SETTING_NAME,
        SettingLevel.ACCOUNT,
    );

    const homeServer = MatrixClientPeg.getHomeserverName();
    const configServers = new Set<string>(SdkConfig.getObject("room_directory")?.get("servers") ?? []);
    removeAll(configServers, homeServer);
    // configured servers take preference over user-defined ones, if one occurs in both ignore the latter one.
    const removableServers = new Set(userDefinedServers);
    removeAll(removableServers, homeServer);
    removeAll(removableServers, ...configServers);

    return {
        allServers: [
            // we always show our connected HS, this takes precedence over it being configured or user-defined
            homeServer,
            ...Array.from(configServers).sort(),
            ...Array.from(removableServers).sort(),
        ],
        homeServer,
        userDefinedServers: Array.from(removableServers).sort(),
        setUserDefinedServers,
    };
}

interface IProps {
    protocols: Protocols | null;
    config: IPublicRoomDirectoryConfig | null;
    setConfig: (value: IPublicRoomDirectoryConfig | null) => void;
}

export const NetworkDropdown: React.FC<IProps> = ({ protocols, config, setConfig }) => {
    const { allServers, homeServer, userDefinedServers, setUserDefinedServers } = useServers();

    const options: GenericDropdownMenuItem<IPublicRoomDirectoryConfig | null>[] = allServers.map((roomServer) => ({
        key: { roomServer, instanceId: undefined },
        label: roomServer,
        description:
            roomServer === homeServer ? _t("spotlight|public_rooms|network_dropdown_your_server_description") : null,
        options: [
            {
                key: { roomServer, instanceId: undefined },
                label: _t("common|matrix"),
            },
            ...(roomServer === homeServer && protocols
                ? Object.values(protocols)
                      .flatMap((protocol) => protocol.instances)
                      .map((instance) => ({
                          key: { roomServer, instanceId: instance.instance_id },
                          label: instance.desc,
                      }))
                : []),
        ],
        ...(userDefinedServers.includes(roomServer)
            ? {
                  adornment: (
                      <AccessibleButton
                          className="mx_NetworkDropdown_removeServer"
                          alt={_t("spotlight|public_rooms|network_dropdown_remove_server_adornment", { roomServer })}
                          onClick={() => setUserDefinedServers(without(userDefinedServers, roomServer))}
                      />
                  ),
              }
            : {}),
    }));

    const addNewServer = useCallback(
        ({ closeMenu }) => (
            <>
                <span className="mx_GenericDropdownMenu_divider" />
                <MenuItemRadio
                    active={false}
                    className="mx_GenericDropdownMenu_Option mx_GenericDropdownMenu_Option--item"
                    onClick={async (): Promise<void> => {
                        closeMenu();
                        const { finished } = Modal.createDialog(
                            TextInputDialog,
                            {
                                title: _t("spotlight|public_rooms|network_dropdown_add_dialog_title"),
                                description: _t("spotlight|public_rooms|network_dropdown_add_dialog_description"),
                                button: _t("action|add"),
                                hasCancel: false,
                                placeholder: _t("spotlight|public_rooms|network_dropdown_add_dialog_placeholder"),
                                validator: validServer,
                                fixedWidth: false,
                            },
                            "mx_NetworkDropdown_dialog",
                        );

                        const [ok, newServer] = await finished;
                        if (!ok) return;

                        if (!allServers.includes(newServer)) {
                            setUserDefinedServers([...userDefinedServers, newServer]);
                            setConfig({
                                roomServer: newServer,
                            });
                        }
                    }}
                >
                    <div className="mx_GenericDropdownMenu_Option--label">
                        <span className="mx_NetworkDropdown_addServer">
                            {_t("spotlight|public_rooms|network_dropdown_add_server_option")}
                        </span>
                    </div>
                </MenuItemRadio>
            </>
        ),
        [allServers, setConfig, setUserDefinedServers, userDefinedServers],
    );

    return (
        <GenericDropdownMenu
            className="mx_NetworkDropdown_wrapper"
            value={config}
            toKey={(config: IPublicRoomDirectoryConfig | null) =>
                config ? `${config.roomServer}-${config.instanceId}` : "null"
            }
            options={options}
            onChange={(option) => setConfig(option)}
            selectedLabel={(option) =>
                option?.key
                    ? _t("spotlight|public_rooms|network_dropdown_selected_label_instance", {
                          server: option.key.roomServer,
                          instance: option.key.instanceId ? option.label : "Matrix",
                      })
                    : _t("spotlight|public_rooms|network_dropdown_selected_label")
            }
            AdditionalOptions={addNewServer}
        />
    );
};
