import { MatrixClient, MatrixEvent, Room, StateEvents, TimelineEvents } from "matrix-js-sdk/src/matrix";
import { logger } from "matrix-js-sdk/src/logger";
import Annotation from "./Annotation";

enum CustomEventType {
    MapAnnotation = "m.map.annotation"
}

export const fetchAnnotationEvent = async (roomId: string, matrixClient: MatrixClient): Promise<MatrixEvent | null> => {
    try {
        const room = matrixClient.getRoom(roomId);
        if (!room) {
            console.error("Room not found");
            return null;
        }
        const annotationEventId = getAnnotationEventId(room);
        if (!annotationEventId) {
            console.error("Read pins event ID not found");
            return null;
        }
        let localEvent =  room.findEventById(annotationEventId);

        // Decrypt if necessary
        if (localEvent?.isEncrypted()) {
            await matrixClient.decryptEventIfNeeded(localEvent, { emit: false });
        }

        if (localEvent) {
            return localEvent; // Return the pinned event itself
        }
        return null;
    } catch (err) {
        logger.error(`Error looking up pinned event in room ${roomId}`);
        logger.error(err);
    }
    return null;
};

function getAnnotationEventId(room?: Room): string {
    const events = room?.currentState.getStateEvents(CustomEventType.MapAnnotation);
    if (!events || events.length === 0) {
        return ""; // Return an empty array if no events are found
    }
    const content = events[0].getContent(); // Get content from the event
    const annotationEventId = content.event_id || "";
    return annotationEventId;
}

export async function extractAnnotations(roomId: string, matrixClient: MatrixClient): Promise<string | null> {
    try {
        const pinEvent = await fetchAnnotationEvent(roomId, matrixClient);
        if(!pinEvent) {
            return null;
        }
        
        let rawContent: string = pinEvent.getContent()["body"];
        return rawContent;
    
    } catch (error) {
        console.error("Error retrieving content from pinned event:", error);
        return null; 
    }
}


// Function to update annotations on the server
export const sendAnnotations = async (roomId: string, content:  TimelineEvents[keyof TimelineEvents], matrixClient: MatrixClient) => {
    try {

        let eventid =  await matrixClient.sendEvent(roomId, (CustomEventType.MapAnnotation as unknown) as keyof TimelineEvents, content);
        await matrixClient.sendStateEvent(roomId,  (CustomEventType.MapAnnotation as unknown) as keyof StateEvents, eventid);
        console.log("Annotations updated successfully!");
    } catch (error) {
        console.error("Failed to update annotations:", error);
        throw error; // Rethrow the error for handling in the calling component
    }
};


// Function to save a new annotation
// Function to save an annotation
export const saveAnnotation = async (roomId: string, matrixClient: MatrixClient, annotations: Annotation[]) => {
    try {
        // Convert annotations to a string
        const stringifiedAnnotations = JSON.stringify(annotations);
        if (!stringifiedAnnotations) {
            return [];
        }
        const content = {
            annotations: stringifiedAnnotations, // Use the stringified annotations
        } as unknown as TimelineEvents[keyof TimelineEvents];

        await sendAnnotations(roomId, content, matrixClient);
    } catch (error) {
        console.error("Failed to save annotation:", error);
        // Handle the error appropriately (e.g., notify the user)
        throw error; // Optionally rethrow the error for further handling
    }
};

// Function to delete an annotation
export const deleteAnnotation = async (roomId: string, matrixClient: MatrixClient, geoUri: string, annotations: Annotation[]) => {
    try {
        // Convert annotations to a string
        const stringifiedAnnotations = JSON.stringify(annotations);
        if (!stringifiedAnnotations) {
            return [];
        }
        const content = {
            annotations: stringifiedAnnotations, // Use the stringified annotations
        } as unknown as TimelineEvents[keyof TimelineEvents];

        await sendAnnotations(roomId, content, matrixClient);
    } catch (error) {
        console.error("Failed to delete annotation:", error);
        throw error; // Optionally rethrow the error for further handling
    }
};

// Function to load annotations from the server
export const loadAnnotations = async (roomId: string, matrixClient: MatrixClient): Promise<Annotation[]> => {
    try {
        const room = matrixClient.getRoom(roomId); // Get the room object
        const events = room?.currentState.getStateEvents("m.map.annotation");
        
        if (!events || events.length === 0) {
            return []; // Return an empty array if no events are found
        }

        const event = await fetchAnnotationEvent(roomId, matrixClient);
        if (!event) {
            return [];
        }

        const content = event.getContent(); // Get content from the event
        const stringifiedAnnotations = content.annotations || [];
        if (typeof stringifiedAnnotations !== 'string') {
            console.warn("Content is not a string. Returning early.");
            return []; // or handle accordingly
        }

        // Parse the JSON string back to an array of annotations
        const annotationsArray: Annotation[] = JSON.parse(stringifiedAnnotations);
        
        if (!Array.isArray(annotationsArray) || annotationsArray.length === 0) {
            return []; // Return an empty array if parsing fails or array is empty
        }
        
        return annotationsArray.map((annotation: { geoUri: string; body: string; color?: string; }) => ({
            geoUri: annotation.geoUri,
            body: annotation.body,
            color: annotation.color,
        }));

    } catch (error) {
        console.error("Failed to load annotations:", error);
        return []; // Return an empty array in case of an error
    }
};