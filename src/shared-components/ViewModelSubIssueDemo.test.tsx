/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { useState } from "react";
import EventEmitter from "events";
import { fireEvent, render } from "jest-matrix-react";

import { BaseViewModel } from "../viewmodels/base/BaseViewModel";
import type { ViewModel } from "./ViewModel";
import { useViewModel } from "./useViewModel";

/**
 * View-models will need to listen to events so that it can do some necessary recalculation.
 * Let's create an example of such an event emitter.
 * Once start() is called and until stop() is called, MessageEmitter will continuously emit a "NEW_MESSAGE"
 * event every 500ms.
 */
class MessageEmitter extends EventEmitter {
    public count = 0;
    private timeout?: NodeJS.Timeout;

    public constructor() {
        super();
    }

    public start(): void {
        this.timeout = setInterval(() => {
            this.count = this.count + 1;
            this.emit("NEW_MESSAGE");
        }, 500);
    }

    public stop(): void {
        clearInterval(this.timeout);
    }
}

/**
 * We're going to create a message counter component that just renders the total message count.
 */

interface MessageCounterViewModelProps {
    /**
     * An emitter that lets the vm know when a new message has arrived.
     */
    emitter: MessageEmitter;
}

interface MessageCounterViewState {
    /**
     * The number of messages in this room
     */
    count: number;
}

/**
 * This view model is written with the API that we have today.
 */
class MessageCounterViewModel extends BaseViewModel<MessageCounterViewState, MessageCounterViewModelProps> {
    public constructor(props: MessageCounterViewModelProps) {
        super(props, { count: 0 });
    }

    private onMessage = (): void => {
        // Increase the count by 1 on new message event
        const count = this.snapshot.current.count + 1;
        this.snapshot.set({ count });
    };

    protected addDownstreamSubscription(): void {
        this.props.emitter.on("NEW_MESSAGE", this.onMessage);
    }

    protected removeDownstreamSubscription(): void {
        this.props.emitter.off("NEW_MESSAGE", this.onMessage);
    }
}

/**
 * This is the fixed version of above with the lifetime of the event listeners being
 * equal to the lifetime of the view-model itself.
 */
class MessageCounterViewModelFixed extends BaseViewModel<MessageCounterViewState, MessageCounterViewModelProps> {
    public constructor(props: MessageCounterViewModelProps) {
        super(props, { count: 0 });
        this.props.emitter.on("NEW_MESSAGE", this.onMessage);
    }

    private onMessage = (): void => {
        // Increase the count by 1 on new message event
        const count = this.snapshot.current.count + 1;
        this.snapshot.set({ count });
    };

    protected addDownstreamSubscription(): void {}

    protected removeDownstreamSubscription(): void {}
}

interface MessageCounterViewProps {
    vm: ViewModel<MessageCounterViewState>;
}
const MessageCounterView: React.FC<MessageCounterViewProps> = ({ vm }) => {
    const snapshot = useViewModel(vm);
    // Nothing too interesting, just render the count from the vm.
    return <div>{snapshot.count}</div>;
};

const emitter = new MessageEmitter();

const RoomTileView = ({ vm }: { vm: ViewModel<MessageCounterViewState> }): React.ReactNode => {
    const [hovered, setHovered] = useState(false);
    // const vm = useMemo(() => new MessageCounterViewModelFixed({ emitter }), []);

    /**
     * This is similar to the room tile in the room list.
     * It shows the count when your mouse cursor is outside the tile.
     * It shows some icon (say 'i') when the mouse cursor is inside the tile. In our
     * actual room tile in element web, this would be the notification options icon.
     */
    return (
        <div
            className="root"
            onMouseEnter={() => {
                setHovered(true);
            }}
            onMouseLeave={() => {
                setHovered(false);
            }}
        >
            <div className="avatar">F</div>
            <div className="name">Foo Room</div>
            <div className="icon">{hovered ? <div>i</div> : <MessageCounterView vm={vm} />}</div>
        </div>
    );
};

it.each([
    ["Unfixed ViewModel", new MessageCounterViewModel({ emitter })],
    ["Fixed ViewModel", new MessageCounterViewModelFixed({ emitter })],
])(
    "view has stale state demo, vm type = %s",
    async (_, vm) => {
        // 1. First let's just render our component
        render(<RoomTileView vm={vm} />);
        // 2. Let's instruct the emitter to start spawning new events
        emitter.start();
        // 3. Let's wait three seconds so that the counts can actually increment.
        await new Promise((r) => setTimeout(r, 3000));
        // 4. Stopping the emitter while we do our assert
        emitter.stop();
        // 5. We haven't moved our mouse inside the tile, so we expect the count
        // in MessageCounterView component to match the total number of events that
        // have been emitted so far.
        expect(document.querySelector(".icon")).toHaveTextContent(`${emitter.count}`);

        // 6. Let's start emitting events again
        emitter.start();
        // 7. This time, we're going to move the cursor into the tile
        fireEvent.mouseEnter(document.querySelector(".root")!);
        // 8. So now we expect the icon to be shown instead of message counter
        expect(document.querySelector(".icon")).toHaveTextContent("i");
        // 9. Let's say that the mouse is inside for 3 seconds
        await new Promise((r) => setTimeout(r, 3000));
        // 10. Let's move the cursor out of the tile
        fireEvent.mouseLeave(document.querySelector(".root")!);
        // 11. As before, the icon should be unmounted and the message counter should be shown again.
        expect(document.querySelector(".icon")).not.toHaveTextContent("i");
        // 12. Stop the emitter before assert
        emitter.stop();

        // 13. This is where the issue arises. We would expect the message counter to show the correct
        // count. But it's going to be incorrect because the view model did not respond to any of the
        // events from the emitter while the view was unmounted (when the icon 'i' was rendered).
        expect(document.querySelector(".icon")).toHaveTextContent(`${emitter.count}`);
    },
    30000,
);
