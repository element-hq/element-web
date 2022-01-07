/*
Copyright 2021 The Matrix.org Foundation C.I.C.

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

import { Callback } from "../client";
import { IContent, IEvent } from "../models/event";
import { Preset, Visibility } from "./partials";
import { SearchKey } from "./search";
import { IRoomEventFilter } from "../filter";

// allow camelcase as these are things that go onto the wire
/* eslint-disable camelcase */

export interface IJoinRoomOpts {
    /**
     * True to do a room initial sync on the resulting
     * room. If false, the <strong>returned Room object will have no current state.
     * </strong> Default: true.
     */
    syncRoom?: boolean;

    /**
     * If the caller has a keypair 3pid invite, the signing URL is passed in this parameter.
     */
    inviteSignUrl?: string;

    /**
     * The server names to try and join through in addition to those that are automatically chosen.
     */
    viaServers?: string[];
}

export interface IRedactOpts {
    reason?: string;
}

export interface ISendEventResponse {
    event_id: string;
}

export interface IPresenceOpts {
    presence: "online" | "offline" | "unavailable";
    status_msg?: string;
}

export interface IPaginateOpts {
    backwards?: boolean;
    limit?: number;
}

export interface IGuestAccessOpts {
    allowJoin: boolean;
    allowRead: boolean;
}

export interface ISearchOpts {
    keys?: SearchKey[];
    query: string;
}

export interface IEventSearchOpts {
    filter?: IRoomEventFilter;
    term: string;
}

export interface IInvite3PID {
    id_server: string;
    id_access_token?: string; // this gets injected by the js-sdk
    medium: string;
    address: string;
}

export interface ICreateRoomStateEvent {
    type: string;
    state_key?: string; // defaults to an empty string
    content: IContent;
}

export interface ICreateRoomOpts {
    room_alias_name?: string;
    visibility?: Visibility;
    name?: string;
    topic?: string;
    preset?: Preset;
    power_level_content_override?: object;
    creation_content?: object;
    initial_state?: ICreateRoomStateEvent[];
    invite?: string[];
    invite_3pid?: IInvite3PID[];
    is_direct?: boolean;
    room_version?: string;
}

export interface IRoomDirectoryOptions {
    server?: string;
    limit?: number;
    since?: string;
    filter?: {
        generic_search_term: string;
    };
    include_all_networks?: boolean;
    third_party_instance_id?: string;
}

export interface IUploadOpts {
    name?: string;
    includeFilename?: boolean;
    type?: string;
    rawResponse?: boolean;
    onlyContentUri?: boolean;
    callback?: Callback;
    progressHandler?: (state: {loaded: number, total: number}) => void;
}

export interface IAddThreePidOnlyBody {
    auth?: {
        type: string;
        session?: string;
    };
    client_secret: string;
    sid: string;
}

export interface IBindThreePidBody {
    client_secret: string;
    id_server: string;
    id_access_token: string;
    sid: string;
}

export interface IRelationsRequestOpts {
    from?: string;
    to?: string;
    limit?: number;
}

export interface IRelationsResponse {
    original_event: IEvent;
    chunk: IEvent[];
    next_batch?: string;
    prev_batch?: string;
}

/* eslint-enable camelcase */
