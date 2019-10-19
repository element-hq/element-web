import {useRef, useEffect} from "react";

// Hook to wrap event emitter on and removeListener in hook lifecycle
export const useEventEmitter = (emitter, eventName, handler) => {
    // Create a ref that stores handler
    const savedHandler = useRef();

    // Update ref.current value if handler changes.
    // This allows our effect below to always get latest handler ...
    // ... without us needing to pass it in effect deps array ...
    // ... and potentially cause effect to re-run every render.
    useEffect(() => {
        savedHandler.current = handler;
    }, [handler]);

    useEffect(
        () => {
            // Make sure element supports on
            const isSupported = emitter && emitter.on;
            if (!isSupported) return;

            // Create event listener that calls handler function stored in ref
            const eventListener = event => savedHandler.current(event);

            // Add event listener
            emitter.on(eventName, eventListener);

            // Remove event listener on cleanup
            return () => {
                emitter.removeListener(eventName, eventListener);
            };
        },
        [eventName, emitter], // Re-run if eventName or emitter changes
    );
};
