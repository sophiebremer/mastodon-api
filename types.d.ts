import HTTP from 'http';
import Stream from 'stream';

export type Callback = (
    err: Error,
    data: unknown,
    response: HTTP.IncomingMessage
) => void;

export interface Config {
    access_token?: string;
    api_url?: string;
    timeout_ms?: number;
    trusted_cert_fingerprints?: Array<string>;
}

export interface Tokens {
    id: string;
    client_id: string;
    client_secret: string;
}

declare class Mastodon {
    constructor (config: Config);
    /** @deprecated */
    createOAuthApp(
        url: string,
        clientName: string,
        scopes: string,
        redirectUri: string
    ): Tokens;
    get(
        path: string,
        callback: Callback
    ): void;
    get(
        path: string,
        params: Record<string, any>,
        callback: Callback
    ): void;
    getAuth(): Tokens;
    /** @deprecated */
    getAuthorizationUrl(
        clientId: string,
        clientSecret: string,
        baseUrl?: string, /* default: https://mastodon.social */
        scope?: string, /* default: read write follow */
        redirectUri?: string /* default: urn:ietf:wg:oauth:2.0:oob */
    ): string;
    post(
        path: string,
        callback: Callback
    ): void;
    post(
        path: string,
        params: Record<string, any>,
        callback: Callback
    ): void;
    setAuth(tokens: Tokens): void;
    stream(path: string): Stream;
    stream(path: string, params: Record<string, any>): Stream;
}

export default Mastodon;
