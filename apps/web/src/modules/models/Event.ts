import type { MatrixEvent } from "matrix-js-sdk/src/matrix";
import type { MatrixEvent as ModuleMatrixEvent } from "@element-hq/element-web-module-api";

/**
 * Convert a JS-SDK room MatrixEvent into an object safe for usage with the module API.
 * @param mxEvent The room event.
 * @returns A Matrix event if the event contains a truthy eventId, roomId and sender. Otherwise returns null.
 */
export function getModuleMatrixEvent(mxEvent: MatrixEvent): ModuleMatrixEvent | null {
    const eventId = mxEvent.getId();
    const roomId = mxEvent.getRoomId();
    const sender = mxEvent.sender;
    // Typically we wouldn't expect messages without these keys to be rendered
    // by the timeline, but for the sake of type safety.
    if (!eventId || !roomId || !sender) {
        // Not a message event.
        return null;
    }
    return {
        content: mxEvent.getContent(),
        eventId,
        originServerTs: mxEvent.getTs(),
        roomId,
        sender: sender.userId,
        stateKey: mxEvent.getStateKey(),
        type: mxEvent.getType(),
        unsigned: mxEvent.getUnsigned(),
    };
}
