import { MatrixEvent } from "matrix-js-sdk/src/models/event";
import { Room } from "matrix-js-sdk/src/models/room";
import { MatrixClientPeg } from "../../MatrixClientPeg";
import { TimelineWindow } from "matrix-js-sdk/src/timeline-window";
import { arrayFastClone } from "../arrays";
import { exportTypes } from "./exportUtils";
import { RoomMember } from 'matrix-js-sdk/src/models/room-member';

export default abstract class Exporter {
    constructor(protected room: Room, protected exportType: exportTypes, protected numberOfEvents?: number) {}

    protected getTimelineConversation = () : MatrixEvent[] => {
        if (!this.room) return;

        const cli = MatrixClientPeg.get();

        const timelineSet = this.room.getUnfilteredTimelineSet();

        const timelineWindow = new TimelineWindow(
            cli, timelineSet,
            {windowLimit: Number.MAX_VALUE});

        timelineWindow.load(null, 30);

        const events: MatrixEvent[] = timelineWindow.getEvents();

        // Clone and reverse the events so that we preserve the order
        arrayFastClone(events)
            .reverse()
            .forEach(event => {
                cli.decryptEventIfNeeded(event);
            });

        return events;
    };

    protected eventToJson(ev) {
        const jsonEvent = ev.toJSON();
        const e = ev.isEncrypted() ? jsonEvent.decrypted : jsonEvent;
        if (ev.isEncrypted()) {
            e.curve25519Key = ev.getSenderKey();
            e.ed25519Key = ev.getClaimedEd25519Key();
            e.algorithm = ev.getWireContent().algorithm;
            e.forwardingCurve25519KeyChain = ev.getForwardingCurve25519KeyChain();
        } else {
            delete e.curve25519Key;
            delete e.ed25519Key;
            delete e.algorithm;
            delete e.forwardingCurve25519KeyChain;
        }
        return e;
    }


    protected getRequiredEvents = async () : Promise<MatrixEvent[]> => {
        const client = MatrixClientPeg.get();
        const eventMapper = client.getEventMapper({ preventReEmit: true });

        let prevToken: string|null = null;
        let limit = this.numberOfEvents || Number.MAX_VALUE;
        let events: MatrixEvent[] = [];
        const stateRes: any[] = [];
        while (limit) {
            const eventsPerCrawl = Math.min(limit, 100);
            const res = await client._createMessagesRequest(this.room.roomId, prevToken, eventsPerCrawl, "b");

            if (res.state) stateRes.push(...res.state);
            if (res.chunk.length === 0) break;

            limit -= eventsPerCrawl;

            const matrixEvents: MatrixEvent[] = res.chunk.map(eventMapper);

            matrixEvents.forEach(mxEv => events.push(mxEv));

            prevToken = res.end;
        }
        events = events.reverse()
        let stateEvents = [];
        if (stateRes !== undefined) {
            stateEvents = stateRes.map(eventMapper);
        }

        const profiles = {};

        stateEvents.forEach(ev => {
            if (ev.event.content &&
                ev.event.content.membership === "join") {
                profiles[ev.event.sender] = {
                    displayname: ev.event.content.displayname,
                    avatar_url: ev.event.content.avatar_url,
                };
            }
        });

        const decryptionPromises = events
            .filter(event => event.isEncrypted())
            .map(event => {
                return client.decryptEventIfNeeded(event, {
                isRetry: true,
                emit: false,
                });
            });

        // Let us wait for all the events to get decrypted.
        await Promise.all(decryptionPromises);

        const eventsWithProfile = events.map((ev) => {
            const e = this.eventToJson(ev);

            let profile: any = {};
            if (e.sender in profiles) profile = profiles[e.sender];
            const object = {
                event: e,
                profile: profile,
            };
            return object;
        });

        const matrixEvents = eventsWithProfile.map(e => {
            const matrixEvent = eventMapper(e.event);

            const member = new RoomMember(this.room.roomId, matrixEvent.getSender());

            member.name = e.profile.displayname;

            const memberEvent = eventMapper(
                {
                    content: {
                        membership: "join",
                        avatar_url: e.profile.avatar_url,
                        displayname: e.profile.displayname,
                    },
                    type: "m.room.member",
                    event_id: matrixEvent.getId() + ":eventIndex",
                    room_id: matrixEvent.getRoomId(),
                    sender: matrixEvent.getSender(),
                    origin_server_ts: matrixEvent.getTs(),
                    state_key: matrixEvent.getSender(),
                },
            );

            member.events.member = memberEvent;
            matrixEvent.sender = member;

            return matrixEvent;
        });


        return matrixEvents;
    }

    abstract export(): Promise<Blob>;
}
