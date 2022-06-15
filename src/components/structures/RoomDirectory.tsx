/*
Copyright 2019 Michael Telatynski <7t3chguy@gmail.com>
Copyright 2015, 2016, 2019, 2020, 2021 The Matrix.org Foundation C.I.C.

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

import React from "react";
import { IFieldType, IPublicRoomsChunkRoom } from "matrix-js-sdk/src/client";
import { Visibility } from "matrix-js-sdk/src/@types/partials";
import { IRoomDirectoryOptions } from "matrix-js-sdk/src/@types/requests";
import { logger } from "matrix-js-sdk/src/logger";

import { MatrixClientPeg } from "../../MatrixClientPeg";
import dis from "../../dispatcher/dispatcher";
import Modal from "../../Modal";
import { _t } from '../../languageHandler';
import SdkConfig from '../../SdkConfig';
import { instanceForInstanceId, protocolNameForInstanceId, ALL_ROOMS, Protocols } from '../../utils/DirectoryUtils';
import SettingsStore from "../../settings/SettingsStore";
import { IDialogProps } from "../views/dialogs/IDialogProps";
import { IPublicRoomDirectoryConfig, NetworkDropdown } from "../views/directory/NetworkDropdown";
import AccessibleButton, { ButtonEvent } from "../views/elements/AccessibleButton";
import ErrorDialog from "../views/dialogs/ErrorDialog";
import QuestionDialog from "../views/dialogs/QuestionDialog";
import BaseDialog from "../views/dialogs/BaseDialog";
import DirectorySearchBox from "../views/elements/DirectorySearchBox";
import ScrollPanel from "./ScrollPanel";
import Spinner from "../views/elements/Spinner";
import { getDisplayAliasForAliasSet } from "../../Rooms";
import PosthogTrackers from "../../PosthogTrackers";
import { PublicRoomTile } from "../views/rooms/PublicRoomTile";
import { getFieldsForThirdPartyLocation, joinRoomByAlias, showRoom } from "../../utils/rooms";
import { GenericError } from "../../utils/error";

const LAST_SERVER_KEY = "mx_last_room_directory_server";
const LAST_INSTANCE_KEY = "mx_last_room_directory_instance";

interface IProps extends IDialogProps {
    initialText?: string;
}

interface IState {
    publicRooms: IPublicRoomsChunkRoom[];
    loading: boolean;
    protocolsLoading: boolean;
    error?: string | null;
    serverConfig: IPublicRoomDirectoryConfig | null;
    filterString: string;
}

export default class RoomDirectory extends React.Component<IProps, IState> {
    private unmounted = false;
    private nextBatch: string | null = null;
    private filterTimeout: number | null;
    private protocols: Protocols;

    constructor(props) {
        super(props);

        let protocolsLoading = true;
        if (!MatrixClientPeg.get()) {
            // We may not have a client yet when invoked from welcome page
            protocolsLoading = false;
        } else {
            MatrixClientPeg.get().getThirdpartyProtocols().then((response) => {
                this.protocols = response;
                const myHomeserver = MatrixClientPeg.getHomeserverName();
                const lsRoomServer = localStorage.getItem(LAST_SERVER_KEY) ?? undefined;
                const lsInstanceId = localStorage.getItem(LAST_INSTANCE_KEY) ?? undefined;

                let roomServer: string | undefined = myHomeserver;
                if (
                    SdkConfig.getObject("room_directory")?.get("servers")?.includes(lsRoomServer) ||
                    SettingsStore.getValue("room_directory_servers")?.includes(lsRoomServer)
                ) {
                    roomServer = lsRoomServer;
                }

                let instanceId: string | undefined = undefined;
                if (roomServer === myHomeserver && (
                    lsInstanceId === ALL_ROOMS ||
                    Object.values(this.protocols).some(p => p.instances.some(i => i.instance_id === lsInstanceId))
                )) {
                    instanceId = lsInstanceId;
                }

                // Refresh the room list only if validation failed and we had to change these
                if (this.state.serverConfig?.instanceId !== instanceId ||
                    this.state.serverConfig?.roomServer !== roomServer) {
                    this.setState({
                        protocolsLoading: false,
                        serverConfig: roomServer ? { instanceId, roomServer } : null,
                    });
                    this.refreshRoomList();
                    return;
                }
                this.setState({ protocolsLoading: false });
            }, (err) => {
                logger.warn(`error loading third party protocols: ${err}`);
                this.setState({ protocolsLoading: false });
                if (MatrixClientPeg.get().isGuest()) {
                    // Guests currently aren't allowed to use this API, so
                    // ignore this as otherwise this error is literally the
                    // thing you see when loading the client!
                    return;
                }
                const brand = SdkConfig.get().brand;
                this.setState({
                    error: _t(
                        '%(brand)s failed to get the protocol list from the homeserver. ' +
                        'The homeserver may be too old to support third party networks.',
                        { brand },
                    ),
                });
            });
        }

        let serverConfig: IPublicRoomDirectoryConfig | null = null;
        const roomServer = localStorage.getItem(LAST_SERVER_KEY);
        if (roomServer) {
            serverConfig = {
                roomServer,
                instanceId: localStorage.getItem(LAST_INSTANCE_KEY) ?? undefined,
            };
        }

        this.state = {
            publicRooms: [],
            loading: true,
            error: null,
            serverConfig,
            filterString: this.props.initialText || "",
            protocolsLoading,
        };
    }

    componentDidMount() {
        this.refreshRoomList();
    }

    componentWillUnmount() {
        if (this.filterTimeout) {
            clearTimeout(this.filterTimeout);
        }
        this.unmounted = true;
    }

    private refreshRoomList = () => {
        this.nextBatch = null;
        this.setState({
            publicRooms: [],
            loading: true,
        });
        this.getMoreRooms();
    };

    private getMoreRooms(): Promise<boolean> {
        if (!MatrixClientPeg.get()) return Promise.resolve(false);

        this.setState({
            loading: true,
        });

        const filterString = this.state.filterString;
        const roomServer = this.state.serverConfig?.roomServer;
        // remember the next batch token when we sent the request
        // too. If it's changed, appending to the list will corrupt it.
        const nextBatch = this.nextBatch;
        const opts: IRoomDirectoryOptions = { limit: 20 };
        if (roomServer != MatrixClientPeg.getHomeserverName()) {
            opts.server = roomServer;
        }
        if (this.state.serverConfig?.instanceId === ALL_ROOMS) {
            opts.include_all_networks = true;
        } else if (this.state.serverConfig?.instanceId) {
            opts.third_party_instance_id = this.state.serverConfig?.instanceId as string;
        }
        if (this.nextBatch) opts.since = this.nextBatch;
        if (filterString) opts.filter = { generic_search_term: filterString };
        return MatrixClientPeg.get().publicRooms(opts).then((data) => {
            if (
                filterString != this.state.filterString ||
                roomServer != this.state.serverConfig?.roomServer ||
                nextBatch != this.nextBatch) {
                // if the filter or server has changed since this request was sent,
                // throw away the result (don't even clear the busy flag
                // since we must still have a request in flight)
                return false;
            }

            if (this.unmounted) {
                // if we've been unmounted, we don't care either.
                return false;
            }

            this.nextBatch = data.next_batch ?? null;
            this.setState((s) => ({
                ...s,
                publicRooms: [...s.publicRooms, ...(data.chunk || [])],
                loading: false,
            }));
            return Boolean(data.next_batch);
        }, (err) => {
            if (
                filterString != this.state.filterString ||
                roomServer != this.state.serverConfig?.roomServer ||
                nextBatch != this.nextBatch) {
                // as above: we don't care about errors for old requests either
                return false;
            }

            if (this.unmounted) {
                // if we've been unmounted, we don't care either.
                return false;
            }

            logger.error("Failed to get publicRooms: %s", JSON.stringify(err));
            const brand = SdkConfig.get().brand;
            this.setState({
                loading: false,
                error: (
                    _t('%(brand)s failed to get the public room list.', { brand }) +
                    (err && err.message) ? err.message : _t('The homeserver may be unavailable or overloaded.')
                ),
            });
            return false;
        });
    }

    /**
     * A limited interface for removing rooms from the directory.
     * Will set the room to not be publicly visible and delete the
     * default alias. In the long term, it would be better to allow
     * HS admins to do this through the RoomSettings interface, but
     * this needs SPEC-417.
     */
    private removeFromDirectory = (room: IPublicRoomsChunkRoom) => {
        const alias = getDisplayAliasForRoom(room);
        const name = room.name || alias || _t('Unnamed room');

        let desc;
        if (alias) {
            desc = _t('Delete the room address %(alias)s and remove %(name)s from the directory?', { alias, name });
        } else {
            desc = _t('Remove %(name)s from the directory?', { name: name });
        }

        Modal.createDialog(QuestionDialog, {
            title: _t('Remove from Directory'),
            description: desc,
            onFinished: (shouldDelete: boolean) => {
                if (!shouldDelete) return;

                const modal = Modal.createDialog(Spinner);
                let step = _t('remove %(name)s from the directory.', { name: name });

                MatrixClientPeg.get().setRoomDirectoryVisibility(room.room_id, Visibility.Private).then(() => {
                    if (!alias) return;
                    step = _t('delete the address.');
                    return MatrixClientPeg.get().deleteAlias(alias);
                }).then(() => {
                    modal.close();
                    this.refreshRoomList();
                }, (err) => {
                    modal.close();
                    this.refreshRoomList();
                    logger.error("Failed to " + step + ": " + err);
                    Modal.createDialog(ErrorDialog, {
                        title: _t('Error'),
                        description: (err && err.message)
                            ? err.message
                            : _t('The server may be unavailable or overloaded'),
                    });
                });
            },
        });
    };

    private onOptionChange = (serverConfig: IPublicRoomDirectoryConfig) => {
        // clear next batch so we don't try to load more rooms
        this.nextBatch = null;
        this.setState({
            // Clear the public rooms out here otherwise we needlessly
            // spend time filtering lots of rooms when we're about to
            // to clear the list anyway.
            publicRooms: [],
            serverConfig,
            error: null,
        }, this.refreshRoomList);
        // We also refresh the room list each time even though this
        // filtering is client-side. It hopefully won't be client side
        // for very long, and we may have fetched a thousand rooms to
        // find the five gitter ones, at which point we do not want
        // to render all those rooms when switching back to 'all networks'.
        // Easiest to just blow away the state & re-fetch.

        // We have to be careful here so that we don't set instanceId = "undefined"
        localStorage.setItem(LAST_SERVER_KEY, serverConfig.roomServer);
        if (serverConfig.instanceId) {
            localStorage.setItem(LAST_INSTANCE_KEY, serverConfig.instanceId);
        } else {
            localStorage.removeItem(LAST_INSTANCE_KEY);
        }
    };

    private onFillRequest = (backwards: boolean) => {
        if (backwards || !this.nextBatch) return Promise.resolve(false);

        return this.getMoreRooms();
    };

    private onFilterChange = (alias: string) => {
        this.setState({
            filterString: alias?.trim() || "",
        });

        // don't send the request for a little bit,
        // no point hammering the server with a
        // request for every keystroke, let the
        // user finish typing.
        if (this.filterTimeout) {
            clearTimeout(this.filterTimeout);
        }
        this.filterTimeout = setTimeout(() => {
            this.filterTimeout = null;
            this.refreshRoomList();
        }, 700);
    };

    private onFilterClear = () => {
        // update immediately
        this.setState({
            filterString: "",
        }, this.refreshRoomList);

        if (this.filterTimeout) {
            clearTimeout(this.filterTimeout);
        }
    };

    private onJoinFromSearchClick = (alias: string) => {
        const cli = MatrixClientPeg.get();
        try {
            joinRoomByAlias(cli, alias, {
                instanceId: this.state.serverConfig?.instanceId,
                roomServer: this.state.serverConfig?.roomServer,
                protocols: this.protocols,
                metricsTrigger: "RoomDirectory",
            });
        } catch (e) {
            if (e instanceof GenericError) {
                Modal.createDialog(ErrorDialog, {
                    title: e.message,
                    description: e.description,
                });
            } else {
                throw e;
            }
        }
    };

    private onCreateRoomClick = (ev: ButtonEvent) => {
        this.onFinished();
        dis.dispatch({
            action: 'view_create_room',
            public: true,
            defaultName: this.state.filterString.trim(),
        });
        PosthogTrackers.trackInteraction("WebRoomDirectoryCreateRoomButton", ev);
    };

    private onRoomClick = (room: IPublicRoomsChunkRoom, roomAlias?: string, autoJoin = false, shouldPeek = false) => {
        this.onFinished();
        const cli = MatrixClientPeg.get();
        showRoom(cli, room, {
            roomAlias,
            autoJoin,
            shouldPeek,
            roomServer: this.state.serverConfig?.roomServer,
            metricsTrigger: "RoomDirectory",
        });
    };

    private stringLooksLikeId(s: string, fieldType: IFieldType) {
        let pat = /^#[^\s]+:[^\s]/;
        if (fieldType && fieldType.regexp) {
            pat = new RegExp(fieldType.regexp);
        }

        return pat.test(s);
    }

    private onFinished = () => {
        this.props.onFinished(false);
    };

    public render() {
        let content;
        if (this.state.error) {
            content = this.state.error;
        } else if (this.state.protocolsLoading) {
            content = <Spinner />;
        } else {
            const cells = (this.state.publicRooms || [])
                .map(room =>
                    <PublicRoomTile
                        key={room.room_id}
                        room={room}
                        showRoom={this.onRoomClick}
                        removeFromDirectory={this.removeFromDirectory}
                    />,
                );
            // we still show the scrollpanel, at least for now, because
            // otherwise we don't fetch more because we don't get a fill
            // request from the scrollpanel because there isn't one

            let spinner;
            if (this.state.loading) {
                spinner = <Spinner />;
            }

            const createNewButton = <>
                <hr />
                <AccessibleButton kind="primary" onClick={this.onCreateRoomClick} className="mx_RoomDirectory_newRoom">
                    { _t("Create new room") }
                </AccessibleButton>
            </>;

            let scrollPanelContent;
            let footer;
            if (cells.length === 0 && !this.state.loading) {
                footer = <>
                    <h5>{ _t('No results for "%(query)s"', { query: this.state.filterString.trim() }) }</h5>
                    <p>
                        { _t("Try different words or check for typos. " +
                            "Some results may not be visible as they're private and you need an invite to join them.") }
                    </p>
                    { createNewButton }
                </>;
            } else {
                scrollPanelContent = <div className="mx_RoomDirectory_table">
                    { cells }
                </div>;
                if (!this.state.loading && !this.nextBatch) {
                    footer = createNewButton;
                }
            }
            content = <ScrollPanel
                className="mx_RoomDirectory_tableWrapper"
                onFillRequest={this.onFillRequest}
                stickyBottom={false}
                startAtBottom={false}
            >
                { scrollPanelContent }
                { spinner }
                { footer && <div className="mx_RoomDirectory_footer">
                    { footer }
                </div> }
            </ScrollPanel>;
        }

        let listHeader;
        if (!this.state.protocolsLoading) {
            const protocolName = protocolNameForInstanceId(this.protocols, this.state.serverConfig?.instanceId);
            let instanceExpectedFieldType;
            if (
                protocolName &&
                this.protocols &&
                this.protocols[protocolName] &&
                this.protocols[protocolName].location_fields.length > 0 &&
                this.protocols[protocolName].field_types
            ) {
                const lastField = this.protocols[protocolName].location_fields.slice(-1)[0];
                instanceExpectedFieldType = this.protocols[protocolName].field_types[lastField];
            }

            let placeholder = _t('Find a room…');
            if (!this.state.serverConfig?.instanceId || this.state.serverConfig?.instanceId === ALL_ROOMS) {
                placeholder = _t("Find a room… (e.g. %(exampleRoom)s)", {
                    exampleRoom: "#example:" + this.state.serverConfig?.roomServer,
                });
            } else if (instanceExpectedFieldType) {
                placeholder = instanceExpectedFieldType.placeholder;
            }

            let showJoinButton = this.stringLooksLikeId(this.state.filterString, instanceExpectedFieldType);
            if (protocolName) {
                const instance = instanceForInstanceId(this.protocols, this.state.serverConfig?.instanceId);
                if (!instance || getFieldsForThirdPartyLocation(
                    this.state.filterString,
                    this.protocols[protocolName],
                    instance,
                ) === null) {
                    showJoinButton = false;
                }
            }

            listHeader = <div className="mx_RoomDirectory_listheader">
                <DirectorySearchBox
                    className="mx_RoomDirectory_searchbox"
                    onChange={this.onFilterChange}
                    onClear={this.onFilterClear}
                    onJoinClick={this.onJoinFromSearchClick}
                    placeholder={placeholder}
                    showJoinButton={showJoinButton}
                    initialText={this.props.initialText}
                />
                <NetworkDropdown
                    protocols={this.protocols}
                    config={this.state.serverConfig}
                    setConfig={this.onOptionChange}
                />
            </div>;
        }
        const explanation =
            _t("If you can't find the room you're looking for, ask for an invite or <a>create a new room</a>.", {},
                { a: sub => (
                    <AccessibleButton kind="link_inline" onClick={this.onCreateRoomClick}>
                        { sub }
                    </AccessibleButton>
                ) },
            );

        const title = _t("Explore rooms");
        return (
            <BaseDialog
                className="mx_RoomDirectory_dialog"
                hasCancel={true}
                onFinished={this.onFinished}
                title={title}
                screenName="RoomDirectory"
            >
                <div className="mx_RoomDirectory">
                    { explanation }
                    <div className="mx_RoomDirectory_list">
                        { listHeader }
                        { content }
                    </div>
                </div>
            </BaseDialog>
        );
    }
}

// Similar to matrix-react-sdk's MatrixTools.getDisplayAliasForRoom
// but works with the objects we get from the public room list
export function getDisplayAliasForRoom(room: IPublicRoomsChunkRoom) {
    return getDisplayAliasForAliasSet(room.canonical_alias, room.aliases);
}
