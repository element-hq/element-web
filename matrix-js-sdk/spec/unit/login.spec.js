import { TestClient } from '../TestClient';

describe('Login request', function() {
    let client;

    beforeEach(function() {
        client = new TestClient();
    });

    afterEach(function() {
        client.stop();
    });

    it('should store "access_token" and "user_id" if in response', async function() {
        const response = { user_id: 1, access_token: Date.now().toString(16) };

        client.httpBackend.when('POST', '/login').respond(200, response);
        client.httpBackend.flush('/login', 1, 100);
        await client.client.login('m.login.any', { user: 'test', password: '12312za' });

        expect(client.client.getAccessToken()).toBe(response.access_token);
        expect(client.client.getUserId()).toBe(response.user_id);
    });
});
