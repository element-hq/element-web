/*
Copyright 2019 Michael Telatynski <7t3chguy@gmail.com>
Copyright 2016, 2020 The Matrix.org Foundation C.I.C.

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

import React, { useEffect, useState } from "react";
import { MatrixError } from "matrix-js-sdk/src/http-api";

import { MatrixClientPeg } from '../../../MatrixClientPeg';
import { instanceForInstanceId } from '../../../utils/DirectoryUtils';
import {
    ChevronFace,
    ContextMenu,
    ContextMenuButton,
    MenuGroup,
    MenuItem,
    MenuItemRadio,
    useContextMenu,
} from "../../structures/ContextMenu";
import { _t } from "../../../languageHandler";
import SdkConfig from "../../../SdkConfig";
import { useSettingValue } from "../../../hooks/useSettings";
import Modal from "../../../Modal";
import SettingsStore from "../../../settings/SettingsStore";
import withValidation from "../elements/Validation";
import { SettingLevel } from "../../../settings/SettingLevel";
import TextInputDialog from "../dialogs/TextInputDialog";
import QuestionDialog from "../dialogs/QuestionDialog";
import UIStore from "../../../stores/UIStore";
import { compare } from "../../../utils/strings";

export const ALL_ROOMS = Symbol("ALL_ROOMS");

const SETTING_NAME = "room_directory_servers";

const inPlaceOf = (elementRect: Pick<DOMRect, "right" | "top">) => ({
    right: UIStore.instance.windowWidth - elementRect.right,
    top: elementRect.top,
    chevronOffset: 0,
    chevronFace: ChevronFace.None,
});

const validServer = withValidation<undefined, { error?: MatrixError }>({
    deriveData: async ({ value }) => {
        try {
            // check if we can successfully load this server's room directory
            await MatrixClientPeg.get().publicRooms({
                limit: 1,
                server: value,
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
            invalid: () => _t("Enter a server name"),
        }, {
            key: "available",
            final: true,
            test: async (_, { error }) => !error,
            valid: () => _t("Looks good"),
            invalid: ({ error }) => error.errcode === "M_FORBIDDEN"
                ? _t("You are not allowed to view this server's rooms list")
                : _t("Can't find this server or its room list"),
        },
    ],
});

/* eslint-disable camelcase */
export interface IFieldType {
    regexp: string;
    placeholder: string;
}

export interface IInstance {
    desc: string;
    icon?: string;
    fields: object;
    network_id: string;
    // XXX: this is undocumented but we rely on it.
    // we inject a fake entry with a symbolic instance_id.
    instance_id: string | symbol;
}

export interface IProtocol {
    user_fields: string[];
    location_fields: string[];
    icon: string;
    field_types: Record<string, IFieldType>;
    instances: IInstance[];
}
/* eslint-enable camelcase */

export type Protocols = Record<string, IProtocol>;

interface IProps {
    protocols: Protocols;
    selectedServerName: string;
    selectedInstanceId: string | symbol;
    onOptionChange(server: string, instanceId?: string | symbol): void;
}

// This dropdown sources homeservers from three places:
// + your currently connected homeserver
// + homeservers in config.json["roomDirectory"]
// + homeservers in SettingsStore["room_directory_servers"]
// if a server exists in multiple, only keep the top-most entry.

const NetworkDropdown = ({ onOptionChange, protocols = {}, selectedServerName, selectedInstanceId }: IProps) => {
    const [menuDisplayed, handle, openMenu, closeMenu] = useContextMenu<HTMLDivElement>();
    const _userDefinedServers: string[] = useSettingValue(SETTING_NAME);
    const [userDefinedServers, _setUserDefinedServers] = useState(_userDefinedServers);

    const handlerFactory = (server, instanceId) => {
        return () => {
            onOptionChange(server, instanceId);
            closeMenu();
        };
    };

    const setUserDefinedServers = servers => {
        _setUserDefinedServers(servers);
        SettingsStore.setValue(SETTING_NAME, null, SettingLevel.ACCOUNT, servers);
    };
    // keep local echo up to date with external changes
    useEffect(() => {
        _setUserDefinedServers(_userDefinedServers);
    }, [_userDefinedServers]);

    // we either show the button or the dropdown in its place.
    let content;
    if (menuDisplayed) {
        const config = SdkConfig.get();
        const roomDirectory = config.roomDirectory || {};

        const hsName = MatrixClientPeg.getHomeserverName();
        const configServers = new Set<string>(roomDirectory.servers);

        // configured servers take preference over user-defined ones, if one occurs in both ignore the latter one.
        const removableServers = new Set(userDefinedServers.filter(s => !configServers.has(s) && s !== hsName));
        const servers = [
            // we always show our connected HS, this takes precedence over it being configured or user-defined
            hsName,
            ...Array.from(configServers).filter(s => s !== hsName).sort(),
            ...Array.from(removableServers).sort(),
        ];

        // For our own HS, we can use the instance_ids given in the third party protocols
        // response to get the server to filter the room list by network for us.
        // We can't get thirdparty protocols for remote server yet though, so for those
        // we can only show the default room list.
        const options = servers.map(server => {
            const serverSelected = server === selectedServerName;
            const entries = [];

            const protocolsList = server === hsName ? Object.values(protocols) : [];
            if (protocolsList.length > 0) {
                // add a fake protocol with the ALL_ROOMS symbol
                protocolsList.push({
                    instances: [{
                        fields: [],
                        network_id: "",
                        instance_id: ALL_ROOMS,
                        desc: _t("All rooms"),
                    }],
                    location_fields: [],
                    user_fields: [],
                    field_types: {},
                    icon: "",
                });
            }

            protocolsList.forEach(({instances=[]}) => {
                [...instances].sort((b, a) => {
                    return compare(a.desc, b.desc);
                }).forEach(({desc, instance_id: instanceId}) => {
                    entries.push(
                        <MenuItemRadio
                            key={String(instanceId)}
                            active={serverSelected && instanceId === selectedInstanceId}
                            onClick={handlerFactory(server, instanceId)}
                            label={desc}
                            className="mx_NetworkDropdown_server_network"
                        >
                            { desc }
                        </MenuItemRadio>);
                });
            });

            let subtitle;
            if (server === hsName) {
                subtitle = (
                    <div className="mx_NetworkDropdown_server_subtitle">
                        {_t("Your server")}
                    </div>
                );
            }

            let removeButton;
            if (removableServers.has(server)) {
                const onClick = async () => {
                    closeMenu();
                    const {finished} = Modal.createTrackedDialog("Network Dropdown", "Remove server", QuestionDialog, {
                        title: _t("Are you sure?"),
                        description: _t("Are you sure you want to remove <b>%(serverName)s</b>", {
                            serverName: server,
                        }, {
                            b: serverName => <b>{ serverName }</b>,
                        }),
                        button: _t("Remove"),
                        fixedWidth: false,
                    }, "mx_NetworkDropdown_dialog");

                    const [ok] = await finished;
                    if (!ok) return;

                    // delete from setting
                    setUserDefinedServers(servers.filter(s => s !== server));

                    // the selected server is being removed, reset to our HS
                    if (serverSelected) {
                        onOptionChange(hsName, undefined);
                    }
                };
                removeButton = <MenuItem onClick={onClick} label={_t("Remove server")} />;
            }

            // ARIA: in actual fact the entire menu is one large radio group but for better screen reader support
            // we use group to notate server wrongly.
            return (
                <MenuGroup label={server} className="mx_NetworkDropdown_server" key={server}>
                    <div className="mx_NetworkDropdown_server_title">
                        { server }
                        { removeButton }
                    </div>
                    { subtitle }

                    <MenuItemRadio
                        active={serverSelected && !selectedInstanceId}
                        onClick={handlerFactory(server, undefined)}
                        label={_t("Matrix")}
                        className="mx_NetworkDropdown_server_network"
                    >
                        {_t("Matrix")}
                    </MenuItemRadio>
                    { entries }
                </MenuGroup>
            );
        });

        const onClick = async () => {
            closeMenu();
            const { finished } = Modal.createTrackedDialog("Network Dropdown", "Add a new server", TextInputDialog, {
                title: _t("Add a new server"),
                description: _t("Enter the name of a new server you want to explore."),
                button: _t("Add"),
                hasCancel: false,
                placeholder: _t("Server name"),
                validator: validServer,
                fixedWidth: false,
            }, "mx_NetworkDropdown_dialog");

            const [ok, newServer] = await finished;
            if (!ok) return;

            if (!userDefinedServers.includes(newServer)) {
                setUserDefinedServers([...userDefinedServers, newServer]);
            }

            onOptionChange(newServer); // change filter to the new server
        };

        const buttonRect = handle.current.getBoundingClientRect();
        content = <ContextMenu {...inPlaceOf(buttonRect)} onFinished={closeMenu}>
            <div className="mx_NetworkDropdown_menu">
                {options}
                <MenuItem className="mx_NetworkDropdown_server_add" label={undefined} onClick={onClick}>
                    {_t("Add a new server...")}
                </MenuItem>
            </div>
        </ContextMenu>;
    } else {
        let currentValue;
        if (selectedInstanceId === ALL_ROOMS) {
            currentValue = _t("All rooms");
        } else if (selectedInstanceId) {
            const instance = instanceForInstanceId(protocols, selectedInstanceId);
            currentValue = _t("%(networkName)s rooms", {
                networkName: instance.desc,
            });
        } else {
            currentValue = _t("Matrix rooms");
        }

        content = <ContextMenuButton
            className="mx_NetworkDropdown_handle"
            onClick={openMenu}
            isExpanded={menuDisplayed}
        >
            <span>
                {currentValue}
            </span> <span className="mx_NetworkDropdown_handle_server">
                ({selectedServerName})
            </span>
        </ContextMenuButton>;
    }

    return <div className="mx_NetworkDropdown" ref={handle}>
        {content}
    </div>;
};

export default NetworkDropdown;
