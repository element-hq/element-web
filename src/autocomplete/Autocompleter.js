import CommandProvider from './CommandProvider';
import DuckDuckGoProvider from './DuckDuckGoProvider';
import RoomProvider from './RoomProvider';
import UserProvider from './UserProvider';
import EmojiProvider from './EmojiProvider';

const PROVIDERS = [
    UserProvider,
    CommandProvider,
    DuckDuckGoProvider,
    RoomProvider,
    EmojiProvider,
].map(completer => completer.getInstance());

export function getCompletions(query: string, selection: {start: number, end: number}) {
    return PROVIDERS.map(provider => {
        return {
            completions: provider.getCompletions(query, selection),
            provider,
        };
    });
}
