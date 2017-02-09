var React = require('react');
var expect = require('expect');
var sinon = require('sinon');
var ReactDOM = require("react-dom");

var sdk = require('matrix-react-sdk');
var RoomView = sdk.getComponent('structures.RoomView');
var peg = require('../../../src/MatrixClientPeg');

var test_utils = require('../../test-utils');
var q = require('q');

var Skinner = require("../../../src/Skinner");
var stubComponent = require('../../components/stub-component.js');

describe('RoomView', function () {
    var sandbox;
    var parentDiv;

    beforeEach(function() {
        test_utils.beforeEach(this);
        sandbox = test_utils.stubClient();
        parentDiv = document.createElement('div');

        this.oldTimelinePanel = Skinner.getComponent('structures.TimelinePanel');
        this.oldRoomHeader = Skinner.getComponent('views.rooms.RoomHeader');
        Skinner.addComponent('structures.TimelinePanel', stubComponent());
        Skinner.addComponent('views.rooms.RoomHeader', stubComponent());

        peg.get().credentials = { userId: "@test:example.com" };
    });

    afterEach(function() {
        sandbox.restore();

        ReactDOM.unmountComponentAtNode(parentDiv);

        Skinner.addComponent('structures.TimelinePanel', this.oldTimelinePanel);
        Skinner.addComponent('views.rooms.RoomHeader', this.oldRoomHeader);
    });

    it('resolves a room alias to a room id', function (done) {
        peg.get().getRoomIdForAlias.returns(q({room_id: "!randomcharacters:aser.ver"}));

        function onRoomIdResolved(room_id) {
            expect(room_id).toEqual("!randomcharacters:aser.ver");
            done();
        }

        ReactDOM.render(<RoomView roomAddress="#alias:ser.ver" onRoomIdResolved={onRoomIdResolved} />, parentDiv);
    });

    it('joins by alias if given an alias', function (done) {
        peg.get().getRoomIdForAlias.returns(q({room_id: "!randomcharacters:aser.ver"}));
        peg.get().getProfileInfo.returns(q({displayname: "foo"}));
        var roomView = ReactDOM.render(<RoomView roomAddress="#alias:ser.ver" />, parentDiv);

        peg.get().joinRoom = function(x) {
            expect(x).toEqual('#alias:ser.ver');
            done();
        };

        process.nextTick(function() {
            roomView.onJoinButtonClicked();
        });
    });
});
