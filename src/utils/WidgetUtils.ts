/*
Copyright 2019 Travis Ralston
Copyright 2017 - 2020 The Matrix.org Foundation C.I.C.

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

import { base32 } from "rfc4648";
import { IWidget, IWidgetData } from "matrix-widget-api";
import { Room } from "matrix-js-sdk/src/models/room";
import { MatrixEvent } from "matrix-js-sdk/src/models/event";
import { logger } from "matrix-js-sdk/src/logger";
import { ClientEvent, MatrixClient, RoomStateEvent } from "matrix-js-sdk/src/matrix";
import { CallType } from "matrix-js-sdk/src/webrtc/call";
import { randomString, randomLowercaseString, randomUppercaseString } from "matrix-js-sdk/src/randomstring";

import PlatformPeg from "../PlatformPeg";
import SdkConfig from "../SdkConfig";
import dis from "../dispatcher/dispatcher";
import WidgetEchoStore from "../stores/WidgetEchoStore";
import { IntegrationManagers } from "../integrations/IntegrationManagers";
import { WidgetType } from "../widgets/WidgetType";
import { Jitsi } from "../widgets/Jitsi";
import { objectClone } from "./objects";
import { _t } from "../languageHandler";
import { IApp, isAppWidget } from "../stores/WidgetStore";
import { parseUrl } from "./UrlUtils";

// How long we wait for the state event echo to come back from the server
// before waitFor[Room/User]Widget rejects its promise
const WIDGET_WAIT_TIME = 20000;

export interface IWidgetEvent {
    id: string;
    type: string;
    sender: string;
    // eslint-disable-next-line camelcase
    state_key: string;
    content: IApp;
}

export interface UserWidget extends Omit<IWidgetEvent, "content"> {
    content: IWidget & Partial<IApp>;
}

export default class WidgetUtils {
    /**
     * Returns true if user is able to send state events to modify widgets in this room
     * (Does not apply to non-room-based / user widgets)
     * @param client The matrix client of the logged-in user
     * @param roomId -- The ID of the room to check
     * @return Boolean -- true if the user can modify widgets in this room
     * @throws Error -- specifies the error reason
     */
    public static canUserModifyWidgets(client: MatrixClient, roomId?: string): boolean {
        if (!roomId) {
            logger.warn("No room ID specified");
            return false;
        }

        if (!client) {
            logger.warn("User must be be logged in");
            return false;
        }

        const room = client.getRoom(roomId);
        if (!room) {
            logger.warn(`Room ID ${roomId} is not recognised`);
            return false;
        }

        const me = client.getUserId();
        if (!me) {
            logger.warn("Failed to get user ID");
            return false;
        }

        if (room.getMyMembership() !== "join") {
            logger.warn(`User ${me} is not in room ${roomId}`);
            return false;
        }

        // TODO: Enable support for m.widget event type (https://github.com/vector-im/element-web/issues/13111)
        return room.currentState.maySendStateEvent("im.vector.modular.widgets", me);
    }

    // TODO: Generify the name of this function. It's not just scalar.
    /**
     * Returns true if specified url is a scalar URL, typically https://scalar.vector.im/api
     * @param matrixClient The matrix client of the logged-in user
     * @param  {[type]}  testUrlString URL to check
     * @return {Boolean} True if specified URL is a scalar URL
     */
    public static isScalarUrl(testUrlString?: string): boolean {
        if (!testUrlString) {
            logger.error("Scalar URL check failed. No URL specified");
            return false;
        }

        const testUrl = parseUrl(testUrlString);
        let scalarUrls = SdkConfig.get().integrations_widgets_urls;
        if (!scalarUrls || scalarUrls.length === 0) {
            const defaultManager = IntegrationManagers.sharedInstance().getPrimaryManager();
            if (defaultManager) {
                scalarUrls = [defaultManager.apiUrl];
            } else {
                scalarUrls = [];
            }
        }

        for (let i = 0; i < scalarUrls.length; i++) {
            const scalarUrl = parseUrl(scalarUrls[i]);
            if (testUrl && scalarUrl) {
                if (
                    testUrl.protocol === scalarUrl.protocol &&
                    testUrl.host === scalarUrl.host &&
                    scalarUrl.pathname &&
                    testUrl.pathname?.startsWith(scalarUrl.pathname)
                ) {
                    return true;
                }
            }
        }
        return false;
    }

    /**
     * Returns a promise that resolves when a widget with the given
     * ID has been added as a user widget (ie. the accountData event
     * arrives) or rejects after a timeout
     *
     * @param client The matrix client of the logged-in user
     * @param widgetId The ID of the widget to wait for
     * @param add True to wait for the widget to be added,
     *     false to wait for it to be deleted.
     * @returns {Promise} that resolves when the widget is in the
     *     requested state according to the `add` param
     */
    public static waitForUserWidget(client: MatrixClient, widgetId: string, add: boolean): Promise<void> {
        return new Promise((resolve, reject) => {
            // Tests an account data event, returning true if it's in the state
            // we're waiting for it to be in
            function eventInIntendedState(ev?: MatrixEvent): boolean {
                if (!ev) return false;
                if (add) {
                    return ev.getContent()[widgetId] !== undefined;
                } else {
                    return ev.getContent()[widgetId] === undefined;
                }
            }

            const startingAccountDataEvent = client.getAccountData("m.widgets");
            if (eventInIntendedState(startingAccountDataEvent)) {
                resolve();
                return;
            }

            function onAccountData(ev: MatrixEvent): void {
                const currentAccountDataEvent = client.getAccountData("m.widgets");
                if (eventInIntendedState(currentAccountDataEvent)) {
                    client.removeListener(ClientEvent.AccountData, onAccountData);
                    clearTimeout(timerId);
                    resolve();
                }
            }
            const timerId = window.setTimeout(() => {
                client.removeListener(ClientEvent.AccountData, onAccountData);
                reject(new Error("Timed out waiting for widget ID " + widgetId + " to appear"));
            }, WIDGET_WAIT_TIME);
            client.on(ClientEvent.AccountData, onAccountData);
        });
    }

    /**
     * Returns a promise that resolves when a widget with the given
     * ID has been added as a room widget in the given room (ie. the
     * room state event arrives) or rejects after a timeout
     *
     * @param client The matrix client of the logged-in user
     * @param {string} widgetId The ID of the widget to wait for
     * @param {string} roomId The ID of the room to wait for the widget in
     * @param {boolean} add True to wait for the widget to be added,
     *     false to wait for it to be deleted.
     * @returns {Promise} that resolves when the widget is in the
     *     requested state according to the `add` param
     */
    public static waitForRoomWidget(
        client: MatrixClient,
        widgetId: string,
        roomId: string,
        add: boolean,
    ): Promise<void> {
        return new Promise((resolve, reject) => {
            // Tests a list of state events, returning true if it's in the state
            // we're waiting for it to be in
            function eventsInIntendedState(evList?: MatrixEvent[]): boolean {
                const widgetPresent = evList?.some((ev) => {
                    return ev.getContent() && ev.getContent()["id"] === widgetId;
                });
                if (add) {
                    return !!widgetPresent;
                } else {
                    return !widgetPresent;
                }
            }

            const room = client.getRoom(roomId);
            // TODO: Enable support for m.widget event type (https://github.com/vector-im/element-web/issues/13111)
            const startingWidgetEvents = room?.currentState.getStateEvents("im.vector.modular.widgets");
            if (eventsInIntendedState(startingWidgetEvents)) {
                resolve();
                return;
            }

            function onRoomStateEvents(ev: MatrixEvent): void {
                if (ev.getRoomId() !== roomId || ev.getType() !== "im.vector.modular.widgets") return;

                // TODO: Enable support for m.widget event type (https://github.com/vector-im/element-web/issues/13111)
                const currentWidgetEvents = room?.currentState.getStateEvents("im.vector.modular.widgets");

                if (eventsInIntendedState(currentWidgetEvents)) {
                    client.removeListener(RoomStateEvent.Events, onRoomStateEvents);
                    clearTimeout(timerId);
                    resolve();
                }
            }
            const timerId = window.setTimeout(() => {
                client.removeListener(RoomStateEvent.Events, onRoomStateEvents);
                reject(new Error("Timed out waiting for widget ID " + widgetId + " to appear"));
            }, WIDGET_WAIT_TIME);
            client.on(RoomStateEvent.Events, onRoomStateEvents);
        });
    }

    public static setUserWidget(
        client: MatrixClient,
        widgetId: string,
        widgetType: WidgetType,
        widgetUrl: string,
        widgetName: string,
        widgetData: IWidgetData,
    ): Promise<void> {
        // Get the current widgets and clone them before we modify them, otherwise
        // we'll modify the content of the old event.
        const userWidgets = objectClone(WidgetUtils.getUserWidgets(client));

        // Delete existing widget with ID
        try {
            delete userWidgets[widgetId];
        } catch (e) {
            logger.error(`$widgetId is non-configurable`);
        }

        const addingWidget = Boolean(widgetUrl);

        const userId = client.getSafeUserId();

        const content = {
            id: widgetId,
            type: widgetType.preferred,
            url: widgetUrl,
            name: widgetName,
            data: widgetData,
            creatorUserId: userId,
        };

        // Add new widget / update
        if (addingWidget) {
            userWidgets[widgetId] = {
                content: content,
                sender: userId,
                state_key: widgetId,
                type: "m.widget",
                id: widgetId,
            };
        }

        // This starts listening for when the echo comes back from the server
        // since the widget won't appear added until this happens. If we don't
        // wait for this, the action will complete but if the user is fast enough,
        // the widget still won't actually be there.
        return client
            .setAccountData("m.widgets", userWidgets)
            .then(() => {
                return WidgetUtils.waitForUserWidget(client, widgetId, addingWidget);
            })
            .then(() => {
                dis.dispatch({ action: "user_widget_updated" });
            });
    }

    public static setRoomWidget(
        client: MatrixClient,
        roomId: string,
        widgetId: string,
        widgetType?: WidgetType,
        widgetUrl?: string,
        widgetName?: string,
        widgetData?: IWidgetData,
        widgetAvatarUrl?: string,
    ): Promise<void> {
        let content: Partial<IWidget> & { avatar_url?: string };

        const addingWidget = Boolean(widgetUrl);

        if (addingWidget) {
            content = {
                // TODO: Enable support for m.widget event type (https://github.com/vector-im/element-web/issues/13111)
                // For now we'll send the legacy event type for compatibility with older apps/elements
                type: widgetType?.legacy,
                url: widgetUrl,
                name: widgetName,
                data: widgetData,
                avatar_url: widgetAvatarUrl,
            };
        } else {
            content = {};
        }

        return WidgetUtils.setRoomWidgetContent(client, roomId, widgetId, content as IWidget);
    }

    public static setRoomWidgetContent(
        client: MatrixClient,
        roomId: string,
        widgetId: string,
        content: IWidget,
    ): Promise<void> {
        const addingWidget = !!content.url;

        WidgetEchoStore.setRoomWidgetEcho(roomId, widgetId, content);

        // TODO: Enable support for m.widget event type (https://github.com/vector-im/element-web/issues/13111)
        return client
            .sendStateEvent(roomId, "im.vector.modular.widgets", content, widgetId)
            .then(() => {
                return WidgetUtils.waitForRoomWidget(client, widgetId, roomId, addingWidget);
            })
            .finally(() => {
                WidgetEchoStore.removeRoomWidgetEcho(roomId, widgetId);
            });
    }

    /**
     * Get room specific widgets
     * @param  {Room} room The room to get widgets force
     * @return {[object]} Array containing current / active room widgets
     */
    public static getRoomWidgets(room: Room): MatrixEvent[] {
        // TODO: Enable support for m.widget event type (https://github.com/vector-im/element-web/issues/13111)
        const appsStateEvents = room.currentState.getStateEvents("im.vector.modular.widgets");
        if (!appsStateEvents) {
            return [];
        }

        return appsStateEvents.filter((ev) => {
            return ev.getContent().type && ev.getContent().url;
        });
    }

    /**
     * Get user specific widgets (not linked to a specific room)
     * @param client The matrix client of the logged-in user
     * @return {object} Event content object containing current / active user widgets
     */
    public static getUserWidgets(client: MatrixClient | undefined): Record<string, UserWidget> {
        if (!client) {
            throw new Error("User not logged in");
        }
        const userWidgets = client.getAccountData("m.widgets");
        if (userWidgets && userWidgets.getContent()) {
            return userWidgets.getContent();
        }
        return {};
    }

    /**
     * Get user specific widgets (not linked to a specific room) as an array
     * @param client The matrix client of the logged-in user
     * @return {[object]} Array containing current / active user widgets
     */
    public static getUserWidgetsArray(client: MatrixClient | undefined): UserWidget[] {
        return Object.values(WidgetUtils.getUserWidgets(client));
    }

    /**
     * Get active stickerpicker widgets (stickerpickers are user widgets by nature)
     * @param client The matrix client of the logged-in user
     * @return {[object]} Array containing current / active stickerpicker widgets
     */
    public static getStickerpickerWidgets(client: MatrixClient | undefined): UserWidget[] {
        const widgets = WidgetUtils.getUserWidgetsArray(client);
        return widgets.filter((widget) => widget.content?.type === "m.stickerpicker");
    }

    /**
     * Get all integration manager widgets for this user.
     * @param client The matrix client of the logged-in user
     * @returns {Object[]} An array of integration manager user widgets.
     */
    public static getIntegrationManagerWidgets(client: MatrixClient | undefined): UserWidget[] {
        const widgets = WidgetUtils.getUserWidgetsArray(client);
        return widgets.filter((w) => w.content?.type === "m.integration_manager");
    }

    public static getRoomWidgetsOfType(room: Room, type: WidgetType): MatrixEvent[] {
        const widgets = WidgetUtils.getRoomWidgets(room) || [];
        return widgets.filter((w) => {
            const content = w.getContent();
            return content.url && type.matches(content.type);
        });
    }

    public static async removeIntegrationManagerWidgets(client: MatrixClient | undefined): Promise<void> {
        if (!client) {
            throw new Error("User not logged in");
        }
        const widgets = client.getAccountData("m.widgets");
        if (!widgets) return;
        const userWidgets: Record<string, IWidgetEvent> = widgets.getContent() || {};
        Object.entries(userWidgets).forEach(([key, widget]) => {
            if (widget.content && widget.content.type === "m.integration_manager") {
                delete userWidgets[key];
            }
        });
        await client.setAccountData("m.widgets", userWidgets);
    }

    public static addIntegrationManagerWidget(
        client: MatrixClient,
        name: string,
        uiUrl: string,
        apiUrl: string,
    ): Promise<void> {
        return WidgetUtils.setUserWidget(
            client,
            "integration_manager_" + new Date().getTime(),
            WidgetType.INTEGRATION_MANAGER,
            uiUrl,
            "Integration manager: " + name,
            { api_url: apiUrl },
        );
    }

    /**
     * Remove all stickerpicker widgets (stickerpickers are user widgets by nature)
     * @param client The matrix client of the logged-in user
     * @return {Promise} Resolves on account data updated
     */
    public static async removeStickerpickerWidgets(client: MatrixClient | undefined): Promise<void> {
        if (!client) {
            throw new Error("User not logged in");
        }
        const widgets = client.getAccountData("m.widgets");
        if (!widgets) return;
        const userWidgets: Record<string, IWidgetEvent> = widgets.getContent() || {};
        Object.entries(userWidgets).forEach(([key, widget]) => {
            if (widget.content && widget.content.type === "m.stickerpicker") {
                delete userWidgets[key];
            }
        });
        await client.setAccountData("m.widgets", userWidgets);
    }

    public static async addJitsiWidget(
        client: MatrixClient,
        roomId: string,
        type: CallType,
        name: string,
        isVideoChannel: boolean,
        oobRoomName?: string,
    ): Promise<void> {
        const domain = Jitsi.getInstance().preferredDomain;
        const auth = (await Jitsi.getInstance().getJitsiAuth()) ?? undefined;
        const widgetId = randomString(24); // Must be globally unique

        let confId: string;
        if (auth === "openidtoken-jwt") {
            // Create conference ID from room ID
            // For compatibility with Jitsi, use base32 without padding.
            // More details here:
            // https://github.com/matrix-org/prosody-mod-auth-matrix-user-verification
            confId = base32.stringify(Buffer.from(roomId), { pad: false });
        } else {
            // Create a random conference ID
            confId = `Jitsi${randomUppercaseString(1)}${randomLowercaseString(23)}`;
        }

        // TODO: Remove URL hacks when the mobile clients eventually support v2 widgets
        const widgetUrl = new URL(WidgetUtils.getLocalJitsiWrapperUrl({ auth }));
        widgetUrl.search = ""; // Causes the URL class use searchParams instead
        widgetUrl.searchParams.set("confId", confId);

        await WidgetUtils.setRoomWidget(client, roomId, widgetId, WidgetType.JITSI, widgetUrl.toString(), name, {
            conferenceId: confId,
            roomName: oobRoomName ?? client.getRoom(roomId)?.name,
            isAudioOnly: type === CallType.Voice,
            isVideoChannel,
            domain,
            auth,
        });
    }

    public static makeAppConfig(
        appId: string,
        app: Partial<IApp>,
        senderUserId: string,
        roomId: string | undefined,
        eventId: string | undefined,
    ): IApp {
        if (!senderUserId) {
            throw new Error("Widgets must be created by someone - provide a senderUserId");
        }
        app.creatorUserId = senderUserId;

        app.id = appId;
        app.roomId = roomId;
        app.eventId = eventId;
        app.name = app.name || app.type;

        return app as IApp;
    }

    public static getLocalJitsiWrapperUrl(opts: { forLocalRender?: boolean; auth?: string } = {}): string {
        // NB. we can't just encodeURIComponent all of these because the $ signs need to be there
        const queryStringParts = [
            "conferenceDomain=$domain",
            "conferenceId=$conferenceId",
            "isAudioOnly=$isAudioOnly",
            "startWithAudioMuted=$startWithAudioMuted",
            "startWithVideoMuted=$startWithVideoMuted",
            "isVideoChannel=$isVideoChannel",
            "displayName=$matrix_display_name",
            "avatarUrl=$matrix_avatar_url",
            "userId=$matrix_user_id",
            "roomId=$matrix_room_id",
            "theme=$theme",
            "roomName=$roomName",
            `supportsScreensharing=${PlatformPeg.get()?.supportsJitsiScreensharing()}`,
            "language=$org.matrix.msc2873.client_language",
        ];
        if (opts.auth) {
            queryStringParts.push(`auth=${opts.auth}`);
        }
        const queryString = queryStringParts.join("&");

        let baseUrl = window.location.href;
        if (window.location.protocol !== "https:" && !opts.forLocalRender) {
            // Use an external wrapper if we're not locally rendering the widget. This is usually
            // the URL that will end up in the widget event, so we want to make sure it's relatively
            // safe to send.
            // We'll end up using a local render URL when we see a Jitsi widget anyways, so this is
            // really just for backwards compatibility and to appease the spec.
            baseUrl = "https://app.element.io/";
        }
        const url = new URL("jitsi.html#" + queryString, baseUrl); // this strips hash fragment from baseUrl
        return url.href;
    }

    public static getWidgetName(app?: IWidget): string {
        return app?.name?.trim() || _t("Unknown App");
    }

    public static getWidgetDataTitle(app?: IWidget): string {
        return app?.data?.title?.trim() || "";
    }

    public static getWidgetUid(app?: IApp | IWidget): string {
        return app ? WidgetUtils.calcWidgetUid(app.id, isAppWidget(app) ? app.roomId : undefined) : "";
    }

    public static calcWidgetUid(widgetId: string, roomId?: string): string {
        return roomId ? `room_${roomId}_${widgetId}` : `user_${widgetId}`;
    }

    public static editWidget(room: Room, app: IWidget): void {
        // noinspection JSIgnoredPromiseFromCall
        IntegrationManagers.sharedInstance()
            .getPrimaryManager()
            ?.open(room, "type_" + app.type, app.id);
    }

    public static isManagedByManager(app: IWidget): boolean {
        if (WidgetUtils.isScalarUrl(app.url)) {
            const managers = IntegrationManagers.sharedInstance();
            if (managers.hasManager()) {
                // TODO: Pick the right manager for the widget
                const defaultManager = managers.getPrimaryManager();
                return WidgetUtils.isScalarUrl(defaultManager?.apiUrl);
            }
        }
        return false;
    }
}
