import React from 'react';
import ReactDOM from 'react-dom';
import expect, {createSpy} from 'expect';
import Promise from 'bluebird';
import * as testUtils from '../../../test-utils';
import sdk from 'matrix-react-sdk';
const WrappedRoomSettings = testUtils.wrapInMatrixClientContext(sdk.getComponent('views.rooms.RoomSettings'));
import MatrixClientPeg from '../../../../src/MatrixClientPeg';
import SettingsStore from '../../../../src/settings/SettingsStore';


describe('RoomSettings', () => {
    let parentDiv = null;
    let sandbox = null;
    let client = null;
    let roomSettings = null;
    const room = testUtils.mkStubRoom('!DdJkzRliezrwpNebLk:matrix.org');

    function expectSentStateEvent(roomId, eventType, expectedEventContent) {
        let found = false;
        for (const call of client.sendStateEvent.calls) {
            const [
                actualRoomId,
                actualEventType,
                actualEventContent,
            ] = call.arguments.slice(0, 3);

            if (roomId === actualRoomId && actualEventType === eventType) {
                expect(actualEventContent).toEqual(expectedEventContent);
                found = true;
                break;
            }
        }
        expect(found).toBe(true);
    }

    beforeEach(function(done) {
        testUtils.beforeEach(this);
        sandbox = testUtils.stubClient();
        client = MatrixClientPeg.get();
        client.credentials = {userId: '@me:domain.com'};

        client.setRoomName = createSpy().andReturn(Promise.resolve());
        client.setRoomTopic = createSpy().andReturn(Promise.resolve());
        client.setRoomDirectoryVisibility = createSpy().andReturn(Promise.resolve());

        // Covers any room state event (e.g. name, avatar, topic)
        client.sendStateEvent = createSpy().andReturn(Promise.resolve());

        // Covers room tagging
        client.setRoomTag = createSpy().andReturn(Promise.resolve());
        client.deleteRoomTag = createSpy().andReturn(Promise.resolve());

        // Covers any setting in the SettingsStore
        // (including local client settings not stored via matrix)
        SettingsStore.setValue = createSpy().andReturn(Promise.resolve());

        parentDiv = document.createElement('div');
        document.body.appendChild(parentDiv);

        const gatherWrappedRef = (r) => {roomSettings = r;};

        // get use wrappedRef because we're using wrapInMatrixClientContext
        ReactDOM.render(
            <WrappedRoomSettings
                wrappedRef={gatherWrappedRef}
                room={room}
            />,
            parentDiv,
            done,
        );
    });

    afterEach((done) => {
        if (parentDiv) {
            ReactDOM.unmountComponentAtNode(parentDiv);
            parentDiv.remove();
            parentDiv = null;
        }
        sandbox.restore();
        done();
    });

    it('should not set when no setting is changed', (done) => {
        roomSettings.save().then(() => {
            expect(client.sendStateEvent).toNotHaveBeenCalled();
            expect(client.setRoomTag).toNotHaveBeenCalled();
            expect(client.deleteRoomTag).toNotHaveBeenCalled();
            done();
        });
    });

    // XXX: Apparently we do call SettingsStore.setValue
    xit('should not settings via the SettingsStore when no setting is changed', (done) => {
        roomSettings.save().then(() => {
            expect(SettingsStore.setValue).toNotHaveBeenCalled();
            done();
        });
    });

    it('should set room name when it has changed', (done) => {
        const name = "My Room Name";
        roomSettings.setName(name);

        roomSettings.save().then(() => {
            expect(client.setRoomName.calls[0].arguments.slice(0, 2))
                .toEqual(['!DdJkzRliezrwpNebLk:matrix.org', name]);

            done();
        });
    });

    it('should set room topic when it has changed', (done) => {
        const topic = "this is a topic";
        roomSettings.setTopic(topic);

        roomSettings.save().then(() => {
            expect(client.setRoomTopic.calls[0].arguments.slice(0, 2))
                .toEqual(['!DdJkzRliezrwpNebLk:matrix.org', topic]);

            done();
        });
    });

    it('should set history visibility when it has changed', (done) => {
        const historyVisibility = "translucent";
        roomSettings.setState({
            history_visibility: historyVisibility,
        });

        roomSettings.save().then(() => {
            expectSentStateEvent(
                "!DdJkzRliezrwpNebLk:matrix.org",
                "m.room.history_visibility", {history_visibility: historyVisibility},
            );
            done();
        });
    });

    // XXX: Can't test this because we `getRoomDirectoryVisibility` in `componentWillMount`
    xit('should set room directory publicity when set to true', (done) => {
        const isRoomPublished = true;
        roomSettings.setState({
            isRoomPublished,
        }, () => {
            roomSettings.save().then(() => {
                expect(client.setRoomDirectoryVisibility.calls[0].arguments.slice(0, 2))
                    .toEqual("!DdJkzRliezrwpNebLk:matrix.org", isRoomPublished ? "public" : "private");
                done();
            });
        });
    });

    it('should set power levels when changed', (done) => {
        roomSettings.onPowerLevelsChanged(42, "invite");

        roomSettings.save().then(() => {
            expectSentStateEvent(
                "!DdJkzRliezrwpNebLk:matrix.org",
                "m.room.power_levels", { invite: 42 },
            );
            done();
        });
    });

    it('should set event power levels when changed', (done) => {
        roomSettings.onPowerLevelsChanged(42, "event_levels_m.room.message");

        roomSettings.save().then(() => {
            // We expect all state events to be set to the state_default (50)
            // See powerLevelDescriptors in RoomSettings
            expectSentStateEvent(
                "!DdJkzRliezrwpNebLk:matrix.org",
                "m.room.power_levels", {
                    events: {
                        'm.room.message': 42,
                        'm.room.avatar': 50,
                        'm.room.name': 50,
                        'm.room.canonical_alias': 50,
                        'm.room.history_visibility': 50,
                        'm.room.power_levels': 50,
                        'm.room.topic': 50,
                        'im.vector.modular.widgets': 50,
                    },
                },
            );
            done();
        });
    });
});
