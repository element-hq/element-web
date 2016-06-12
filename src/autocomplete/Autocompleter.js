import CommandProvider from './CommandProvider';
import DuckDuckGoProvider from './DuckDuckGoProvider';
import RoomProvider from './RoomProvider';
import UserProvider from './UserProvider';

const PROVIDERS = [
    CommandProvider,
    DuckDuckGoProvider,
    RoomProvider,
    UserProvider
].map(completer => new completer());

export function getCompletions(query: String) {
    return PROVIDERS.map(provider => {
        return {
            completions: provider.getCompletions(query),
            provider
        };
    });
}
