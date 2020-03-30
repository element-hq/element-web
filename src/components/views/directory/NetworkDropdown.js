/*
Copyright 2016 OpenMarket Ltd
Copyright 2019 Michael Telatynski <7t3chguy@gmail.com>
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

import React, {useEffect, useState} from 'react';
import PropTypes from 'prop-types';

import {MatrixClientPeg} from '../../../MatrixClientPeg';
import {instanceForInstanceId} from '../../../utils/DirectoryUtils';
import {
    ContextMenu,
    useContextMenu,
    ContextMenuButton,
    MenuItemRadio,
    MenuItem,
    MenuGroup,
} from "../../structures/ContextMenu";
import {_t} from "../../../languageHandler";
import SdkConfig from "../../../SdkConfig";
import {useSettingValue} from "../../../hooks/useSettings";
import * as sdk from "../../../index";
import Modal from "../../../Modal";
import SettingsStore from "../../../settings/SettingsStore";
import withValidation from "../elements/Validation";

export const ALL_ROOMS = Symbol("ALL_ROOMS");

const SETTING_NAME = "room_directory_servers";

const inPlaceOf = (elementRect) => ({
    right: window.innerWidth - elementRect.right,
    top: elementRect.top,
    chevronOffset: 0,
    chevronFace: "none",
});

const validServer = withValidation({
    rules: [
        {
            key: "required",
            test: async ({ value }) => !!value,
            invalid: () => _t("Enter a server name"),
        }, {
            key: "available",
            final: true,
            test: async ({ value }) => {
                try {
                    const opts = {
                        limit: 1,
                        server: value,
                    };
                    // check if we can successfully load this server's room directory
                    await MatrixClientPeg.get().publicRooms(opts);
                    return true;
                } catch (e) {
                    return false;
                }
            },
            valid: () => _t("Looks good"),
            invalid: () => _t("Can't find this server or its room list"),
        },
    ],
});

// This dropdown sources homeservers from three places:
// + your currently connected homeserver
// + homeservers in config.json["roomDirectory"]
// + homeservers in SettingsStore["room_directory_servers"]
// if a server exists in multiple, only keep the top-most entry.

const NetworkDropdown = ({onOptionChange, protocols = {}, selectedServerName, selectedInstanceId}) => {
    const [menuDisplayed, handle, openMenu, closeMenu] = useContextMenu();
    const _userDefinedServers = useSettingValue(SETTING_NAME);
    const [userDefinedServers, _setUserDefinedServers] = useState(_userDefinedServers);

    const handlerFactory = (server, instanceId) => {
        return () => {
            onOptionChange(server, instanceId);
            closeMenu();
        };
    };

    const setUserDefinedServers = servers => {
        _setUserDefinedServers(servers);
        SettingsStore.setValue(SETTING_NAME, null, "account", servers);
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
        const configServers = new Set(roomDirectory.servers);

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
                        instance_id: ALL_ROOMS,
                        desc: _t("All rooms"),
                    }],
                });
            }

            protocolsList.forEach(({instances=[]}) => {
                [...instances].sort((b, a) => {
                    return a.desc.localeCompare(b.desc);
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
                    const QuestionDialog = sdk.getComponent("dialogs.QuestionDialog");
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
                    if (serverSelected === server) {
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
            const TextInputDialog = sdk.getComponent("dialogs.TextInputDialog");
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

NetworkDropdown.propTypes = {
    onOptionChange: PropTypes.func.isRequired,
    protocols: PropTypes.object,
};

export default NetworkDropdown;
