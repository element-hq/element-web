/*
Copyright 2024 New Vector Ltd.
Copyright 2020 The Matrix.org Foundation C.I.C.
Copyright 2019 Michael Telatynski <7t3chguy@gmail.com>
Copyright 2018 New Vector Ltd
Copyright 2015, 2016 OpenMarket Ltd

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type MatrixClient } from "matrix-js-sdk/src/matrix";

import { _td } from "../languageHandler";
import { reject, success } from "./utils";
import { isPermalinkHost, parsePermalink } from "../utils/permalinks/Permalinks";
import dis from "../dispatcher/dispatcher";
import { type ViewRoomPayload } from "../dispatcher/payloads/ViewRoomPayload";
import { Action } from "../dispatcher/actions";
import { TimelineRenderingType } from "../contexts/RoomContext";
import { Command } from "./command";
import { CommandCategories, type RunResult } from "./interface";

// A return of undefined here signals a usage error, where the command should return `reject(this.getUsage());`
function openRoom(cli: MatrixClient, args: string | undefined, autoJoin: boolean): RunResult | undefined {
    if (!args) return;
    const params = args.split(" ");
    if (params.length < 1) return;

    let isPermalink = false;
    if (params[0].startsWith("http:") || params[0].startsWith("https:")) {
        // It's at least a URL - try and pull out a hostname to check against the
        // permalink handler
        const parsedUrl = new URL(params[0]);
        const hostname = parsedUrl.host || parsedUrl.hostname; // takes first non-falsey value

        // if we're using a Element permalink handler, this will catch it before we get much further.
        // see below where we make assumptions about parsing the URL.
        if (isPermalinkHost(hostname)) {
            isPermalink = true;
        }
    }

    if (params[0][0] === "#") {
        let roomAlias = params[0];
        if (!roomAlias.includes(":")) {
            roomAlias += ":" + cli.getDomain();
        }

        dis.dispatch<ViewRoomPayload>({
            action: Action.ViewRoom,
            room_alias: roomAlias,
            auto_join: autoJoin,
            metricsTrigger: "SlashCommand",
            metricsViaKeyboard: true,
        });
        return success();
    }

    if (params[0][0] === "!") {
        const [roomId, ...viaServers] = params;

        dis.dispatch<ViewRoomPayload>({
            action: Action.ViewRoom,
            room_id: roomId,
            via_servers: viaServers, // for the rejoin button
            auto_join: autoJoin,
            metricsTrigger: "SlashCommand",
            metricsViaKeyboard: true,
        });
        return success();
    }

    if (isPermalink) {
        const permalinkParts = parsePermalink(params[0]);

        // This check technically isn't needed because we already did our
        // safety checks up above. However, for good measure, let's be sure.
        if (!permalinkParts) {
            return;
        }

        // If for some reason someone wanted to join a user, we should
        // stop them now.
        if (!permalinkParts.roomIdOrAlias) {
            return;
        }

        const entity = permalinkParts.roomIdOrAlias;
        const viaServers = permalinkParts.viaServers;
        const eventId = permalinkParts.eventId;

        const dispatch: ViewRoomPayload = {
            action: Action.ViewRoom,
            auto_join: autoJoin,
            metricsTrigger: "SlashCommand",
            metricsViaKeyboard: true,
        };

        if (entity[0] === "!") dispatch["room_id"] = entity;
        else dispatch["room_alias"] = entity;

        if (eventId) {
            dispatch["event_id"] = eventId;
            dispatch["highlighted"] = true;
        }

        if (viaServers) {
            // For the join, these are passed down to the js-sdk's /join call
            dispatch["opts"] = { viaServers };

            // For if the join fails (rejoin button)
            dispatch["via_servers"] = viaServers;
        }

        dis.dispatch(dispatch);
        return success();
    }

    // Otherwise, it's a usage error. Return `undefined`.
}

// Note: we support 2 versions of this command. The first is
// the public-facing one for most users and the other is a
// power-user edition where someone may join via permalink or
// room ID with optional servers. Practically, this results
// in the following variations:
//   /join #example:example.org
//   /join !example:example.org
//   /join !example:example.org altserver.com elsewhere.ca
//   /join https://matrix.to/#/!example:example.org?via=altserver.com
// The command also supports event permalinks transparently:
//   /join https://matrix.to/#/!example:example.org/$something:example.org
//   /join https://matrix.to/#/!example:example.org/$something:example.org?via=altserver.com
export const join = new Command({
    command: "join",
    aliases: ["j"],
    args: "<room-address>",
    description: _td("slash_command|join"),
    runFn: function (cli, roomId, threadId, args) {
        return openRoom(cli, args, true) ?? reject(this.getUsage());
    },
    category: CommandCategories.actions,
    renderingTypes: [TimelineRenderingType.Room],
});

// Similar to join but doesn't auto join the room if you aren't already joined to it
export const goto = new Command({
    command: "goto",
    aliases: ["view"],
    args: "<room-address>",
    description: _td("slash_command|view"),
    runFn: function (cli, roomId, threadId, args) {
        return openRoom(cli, args, false) ?? reject(this.getUsage());
    },
    category: CommandCategories.actions,
    renderingTypes: [TimelineRenderingType.Room],
});
