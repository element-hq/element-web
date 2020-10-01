/*
 * Copyright 2020 The Matrix.org Foundation C.I.C.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *         http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { Room } from "matrix-js-sdk/src/models/room";
import {
    ClientWidgetApi,
    IStickerActionRequest,
    IStickyActionRequest,
    IWidget,
    IWidgetApiRequest,
    IWidgetApiRequestEmptyData,
    IWidgetData,
    MatrixCapabilities,
    Widget,
    WidgetApiFromWidgetAction
} from "matrix-widget-api";
import { StopGapWidgetDriver } from "./StopGapWidgetDriver";
import { EventEmitter } from "events";
import { WidgetMessagingStore } from "./WidgetMessagingStore";
import RoomViewStore from "../RoomViewStore";
import { MatrixClientPeg } from "../../MatrixClientPeg";
import { OwnProfileStore } from "../OwnProfileStore";
import WidgetUtils from '../../utils/WidgetUtils';
import { IntegrationManagers } from "../../integrations/IntegrationManagers";
import SettingsStore from "../../settings/SettingsStore";
import { WidgetType } from "../../widgets/WidgetType";
import ActiveWidgetStore from "../ActiveWidgetStore";
import { objectShallowClone } from "../../utils/objects";
import defaultDispatcher from "../../dispatcher/dispatcher";
import { ElementWidgetActions } from "./ElementWidgetActions";

// TODO: Destroy all of this code

interface IAppTileProps {
    // Note: these are only the props we care about

    app: IWidget;
    room: Room;
    userId: string;
    creatorUserId: string;
    waitForIframeLoad: boolean;
    whitelistCapabilities: string[];
    userWidget: boolean;
}

// TODO: Don't use this because it's wrong
class ElementWidget extends Widget {
    constructor(w) {
        super(w);
    }

    public get templateUrl(): string {
        if (WidgetType.JITSI.matches(this.type)) {
            return WidgetUtils.getLocalJitsiWrapperUrl({
                forLocalRender: true,
                auth: this.rawData?.auth,
            });
        }
        return super.templateUrl;
    }

    public get rawData(): IWidgetData {
        let conferenceId = super.rawData['conferenceId'];
        if (conferenceId === undefined) {
            // we'll need to parse the conference ID out of the URL for v1 Jitsi widgets
            const parsedUrl = new URL(this.templateUrl);
            conferenceId = parsedUrl.searchParams.get("confId");
        }
        return {
            ...super.rawData,
            theme: SettingsStore.getValue("theme"),
            conferenceId,
        };
    }
}

export class StopGapWidget extends EventEmitter {
    private messaging: ClientWidgetApi;
    private mockWidget: Widget;
    private scalarToken: string;

    constructor(private appTileProps: IAppTileProps) {
        super();
        let app = appTileProps.app;

        // Backwards compatibility: not all old widgets have a creatorUserId
        if (!app.creatorUserId) {
            app = objectShallowClone(app); // clone to prevent accidental mutation
            app.creatorUserId = MatrixClientPeg.get().getUserId();
        }

        this.mockWidget = new ElementWidget(app);
    }

    public get widgetApi(): ClientWidgetApi {
        return this.messaging;
    }

    /**
     * The URL to use in the iframe
     */
    public get embedUrl(): string {
        const templated = this.mockWidget.getCompleteUrl({
            currentRoomId: RoomViewStore.getRoomId(),
            currentUserId: MatrixClientPeg.get().getUserId(),
            userDisplayName: OwnProfileStore.instance.displayName,
            userHttpAvatarUrl: OwnProfileStore.instance.getHttpAvatarUrl(),
        });

        // Add in some legacy support sprinkles
        // TODO: Replace these with proper widget params
        // See https://github.com/matrix-org/matrix-doc/pull/1958/files#r405714833
        const parsed = new URL(templated);
        parsed.searchParams.set('widgetId', this.mockWidget.id);
        parsed.searchParams.set('parentUrl', window.location.href.split('#', 2)[0]);

        // Give the widget a scalar token if we're supposed to (more legacy)
        // TODO: Stop doing this
        if (this.scalarToken) {
            parsed.searchParams.set('scalar_token', this.scalarToken);
        }

        // Replace the encoded dollar signs back to dollar signs. They have no special meaning
        // in HTTP, but URL parsers encode them anyways.
        return parsed.toString().replace(/%24/g, '$');
    }

    /**
     * The URL to use in the popout
     */
    public get popoutUrl(): string {
        if (WidgetType.JITSI.matches(this.mockWidget.type)) {
            return WidgetUtils.getLocalJitsiWrapperUrl({
                forLocalRender: false,
                auth: this.mockWidget.rawData?.auth,
            });
        }
        return this.embedUrl;
    }

    public get isManagedByManager(): boolean {
        return !!this.scalarToken;
    }

    public get started(): boolean {
        return !!this.messaging;
    }

    public start(iframe: HTMLIFrameElement) {
        if (this.started) return;
        const driver = new StopGapWidgetDriver( this.appTileProps.whitelistCapabilities || []);
        this.messaging = new ClientWidgetApi(this.mockWidget, iframe, driver);
        this.messaging.addEventListener("ready", () => this.emit("ready"));
        WidgetMessagingStore.instance.storeMessaging(this.mockWidget, this.messaging);

        if (!this.appTileProps.userWidget && this.appTileProps.room) {
            ActiveWidgetStore.setRoomId(this.mockWidget.id, this.appTileProps.room.roomId);
        }

        if (WidgetType.JITSI.matches(this.mockWidget.type)) {
            this.messaging.addEventListener("action:set_always_on_screen",
                (ev: CustomEvent<IStickyActionRequest>) => {
                    if (this.messaging.hasCapability(MatrixCapabilities.AlwaysOnScreen)) {
                        ActiveWidgetStore.setWidgetPersistence(this.mockWidget.id, ev.detail.data.value);
                        ev.preventDefault();
                        this.messaging.transport.reply(ev.detail, <IWidgetApiRequestEmptyData>{}); // ack
                    }
                },
            );
        } else if (WidgetType.STICKERPICKER.matches(this.mockWidget.type)) {
            this.messaging.addEventListener(`action:${ElementWidgetActions.OpenIntegrationManager}`,
                (ev: CustomEvent<IWidgetApiRequest>) => {
                    // Acknowledge first
                    ev.preventDefault();
                    this.messaging.transport.reply(ev.detail, <IWidgetApiRequestEmptyData>{});

                    // First close the stickerpicker
                    defaultDispatcher.dispatch({action: "stickerpicker_close"});

                    // Now open the integration manager
                    // TODO: Spec this interaction.
                    const data = ev.detail.data;
                    const integType = data?.integType
                    const integId = <string>data?.integId;

                    // TODO: Open the right integration manager for the widget
                    if (SettingsStore.getValue("feature_many_integration_managers")) {
                        IntegrationManagers.sharedInstance().openAll(
                            MatrixClientPeg.get().getRoom(RoomViewStore.getRoomId()),
                            `type_${integType}`,
                            integId,
                        );
                    } else {
                        IntegrationManagers.sharedInstance().getPrimaryManager().open(
                            MatrixClientPeg.get().getRoom(RoomViewStore.getRoomId()),
                            `type_${integType}`,
                            integId,
                        );
                    }
                },
            );

            // TODO: Replace this event listener with appropriate driver functionality once the API
            // establishes a sane way to send events back and forth.
            this.messaging.addEventListener(`action:${WidgetApiFromWidgetAction.SendSticker}`,
                (ev: CustomEvent<IStickerActionRequest>) => {
                    // Acknowledge first
                    ev.preventDefault();
                    this.messaging.transport.reply(ev.detail, <IWidgetApiRequestEmptyData>{});

                    // Send the sticker
                    defaultDispatcher.dispatch({
                        action: 'm.sticker',
                        data: ev.detail.data,
                        widgetId: this.mockWidget.id,
                    });
                },
            );
        }
    }

    public async prepare(): Promise<void> {
        if (this.scalarToken) return;
        const existingMessaging = WidgetMessagingStore.instance.getMessaging(this.mockWidget);
        if (existingMessaging) this.messaging = existingMessaging;
        try {
            if (WidgetUtils.isScalarUrl(this.mockWidget.templateUrl)) {
                const managers = IntegrationManagers.sharedInstance();
                if (managers.hasManager()) {
                    // TODO: Pick the right manager for the widget
                    const defaultManager = managers.getPrimaryManager();
                    if (WidgetUtils.isScalarUrl(defaultManager.apiUrl)) {
                        const scalar = defaultManager.getScalarClient();
                        this.scalarToken = await scalar.getScalarToken();
                    }
                }
            }
        } catch (e) {
            // All errors are non-fatal
            console.error("Error preparing widget communications: ", e);
        }
    }

    public stop() {
        if (ActiveWidgetStore.getPersistentWidgetId() === this.mockWidget.id) {
            console.log("Skipping destroy - persistent widget");
            return;
        }
        if (!this.started) return;
        WidgetMessagingStore.instance.stopMessaging(this.mockWidget);
        ActiveWidgetStore.delRoomId(this.mockWidget.id);
    }
}
