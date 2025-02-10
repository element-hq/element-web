import { EventTimeline, EventType, MatrixClient, MatrixEvent, Room } from "matrix-js-sdk/src/matrix";
import { logger } from "matrix-js-sdk/src/logger";
import Annotation from "./Annotation";
import { RoomAnnotationEventContent } from "matrix-js-sdk/src/@types/state_events";

import * as MegolmExportEncryptionExport from "../../../../src/utils/MegolmExportEncryption"

export const fetchPinnedEvent = async (roomId: string, matrixClient: MatrixClient): Promise<MatrixEvent | null> => {
    try {
        const room = matrixClient.getRoom(roomId);
        if (!room) {
            console.error("Room not found");
            return null;
        }
        const readPinsEventId = getPinnedEventIds(room)[0];
        if (!readPinsEventId) {
            console.error("Read pins event ID not found");
            return null;
        }
        let localEvent =  room.findEventById(readPinsEventId);

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

function getPinnedEventIds(room?: Room): string[] {
    const eventIds: string[] =
        room
            ?.getLiveTimeline()
            .getState(EventTimeline.FORWARDS)
            ?.getStateEvents(EventType.RoomPinnedEvents, "")
            ?.getContent()?.pinned ?? [];
    // Limit the number of pinned events to 100
    return eventIds.slice(0, 1);
}

export async function extractAnnotationsPassphrase(roomId: string, matrixClient: MatrixClient): Promise<string | null> {
    try {
        const pinEvent = await fetchPinnedEvent(roomId, matrixClient);
        if(!pinEvent) {
            return null;
        }
        
        let rawContent: string = pinEvent.getContent()["body"];
        return rawContent;
    
    } catch (error) {
        console.error("Error retrieving content from pinned event:", error);
        return null; 
    }
    return null;
}


// Function to update annotations on the server
export const sendAnnotations = async (roomId: string, content: RoomAnnotationEventContent, matrixClient: MatrixClient) => {
    try {
        await matrixClient.sendStateEvent(roomId, EventType.RoomAnnotation, content);
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

        const base64EncryptedAnnotations = await encryptAnnotations(roomId, matrixClient, annotations);
        if(!base64EncryptedAnnotations) {
            return [];
        }
        const content = {
            annotations: base64EncryptedAnnotations, // Use the base64 string
        };

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
        // Prepare content for the server
        const base64EncryptedAnnotations = await encryptAnnotations(roomId, matrixClient, annotations);
        if(!base64EncryptedAnnotations) {
            return [];
        }
        const content = {
            annotations: base64EncryptedAnnotations, // Use the base64 string
        };

        await sendAnnotations(roomId, content, matrixClient);
    } catch (error) {
        console.error("Failed to delete annotation:", error);
        // Handle the error appropriately (e.g., notify the user)
        throw error; // Optionally rethrow the error for further handling
    }
};

// Function to load annotations from the server
export const loadAnnotations = async (roomId: string, matrixClient: MatrixClient): Promise<Annotation[]> => {
    try {
        const room = matrixClient.getRoom(roomId); // Get the room object
        const events = room?.currentState.getStateEvents(EventType.RoomAnnotation);
        
        if (!events || events.length === 0) {
            return []; // Return an empty array if no events are found
        }
        const password = await extractAnnotationsPassphrase(roomId, matrixClient);
        if(!password) {
            return [];
        }
        const event = events[0];
        const content = event.getContent(); // Get content from the event
        const encryptedAnnotations = content.annotations || [];
        if (typeof encryptedAnnotations !== 'string') {
            console.warn("Content is not a string. Returning early.");
            return []; // or handle accordingly
        }
        const decryptedArray: Annotation[] = await decryptAnnotations(encryptedAnnotations, password);
        if (Object.keys(content.annotations).length === 0) {
            return [];
        }
        return decryptedArray.map((annotation: { geoUri: string; body: string; color?: string; }) => ({
            geoUri: annotation.geoUri,
            body: annotation.body,
            color: annotation.color,
        }));

    } catch (error) {
        console.error("Failed to load annotations:", error);
        return []; // Return an empty array in case of an error
    }
};

export const decryptAnnotations = async (encryptedAnnotations: string, password: string): Promise<Annotation[]> => {
    try {
        // Convert from base64 string to ArrayBuffer
        const binaryString = atob(encryptedAnnotations);
        const charCodeArray = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            charCodeArray[i] = binaryString.charCodeAt(i);
        }
        const arrayBuffer = charCodeArray.buffer;

        // Decrypt the annotations
        const decryptedAnnotations = await MegolmExportEncryptionExport.decryptMegolmKeyFile(arrayBuffer, password);
        return JSON.parse(decryptedAnnotations); // Convert decrypted string back to JSON
    } catch (error) {
        console.error("Decryption failed:", error);
        throw error; // Rethrow the error for further handling
    }
};

export const encryptAnnotations = async (roomId: string, matrixClient: MatrixClient, annotations: Annotation[]):  Promise<string | null> => {
    const jsonAnnotations = JSON.stringify(annotations);
    const password = await extractAnnotationsPassphrase(roomId, matrixClient);
    
    if (!password) {
        return null;
    }

    const encryptedAnnotations = await MegolmExportEncryptionExport.encryptMegolmKeyFile(jsonAnnotations, password, { kdf_rounds: 1000 });
    const encryptedAnnotationsArray = new Uint8Array(encryptedAnnotations);
    const base64EncryptedAnnotations = btoa(String.fromCharCode(...encryptedAnnotationsArray));

    return base64EncryptedAnnotations; // Return the base64 encoded encrypted annotations
}