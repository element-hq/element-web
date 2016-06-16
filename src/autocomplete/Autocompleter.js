import CommandProvider from './CommandProvider';
import DuckDuckGoProvider from './DuckDuckGoProvider';
import RoomProvider from './RoomProvider';
import UserProvider from './UserProvider';
import EmojiProvider from './EmojiProvider';

const PROVIDERS = [
    CommandProvider,
    DuckDuckGoProvider,
    RoomProvider,
    UserProvider,
    EmojiProvider
].map(completer => new completer());

export function getCompletions(query: String) {
    return PROVIDERS.map(provider => {
        return {
            completions: provider.getCompletions(query),
            provider
        };
    });
}
