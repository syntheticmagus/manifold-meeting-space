import { Observable } from "@babylonjs/core";
import Peer, { DataConnection, MediaConnection } from "peerjs";

export class AsyncMediaConnection {
    private _connection: MediaConnection;
    
    public readonly onStreamObservable: Observable<MediaStream>;
    public readonly onTerminatedObservable: Observable<void>;

    public get peerId(): string {
        return this._connection.peer;
    }

    public get remoteStream(): MediaStream {
        return this._connection.remoteStream;
    }

    public constructor (connection: MediaConnection) {
        this._connection = connection;

        this.onStreamObservable = new Observable<MediaStream>();
        this._connection.on("stream", (stream) => {
            this.onStreamObservable.notifyObservers(stream);
        });

        this.onTerminatedObservable = new Observable<void>();
        this._connection.on("close", () => {
            this.onTerminatedObservable.notifyObservers();
        });
        this._connection.on("error", (error) => {
            console.error(error);
            this.onTerminatedObservable.notifyObservers();
        });
    }

    public answer(stream?: MediaStream) {
        this._connection.answer(stream);
    }
    
    // Workaround for a very old Chrome bug
    // Bug: https://bugs.chromium.org/p/chromium/issues/detail?id=933677
    // Workaround: https://stackoverflow.com/questions/24287054/chrome-wont-play-webaudio-getusermedia-via-webrtc-peer-js
    public workAroundChromeRemoteAudioStreamBug(stream: MediaStream) {
        let audio = new Audio();
        audio.muted = true;
        audio.srcObject = stream;
    }

    public dispose() {
        this._connection.close();
    }
}

export class AsyncDataConnection {
    private _connection: DataConnection;

    public readonly onDataObservable: Observable<any>;
    public readonly onTerminatedObservable: Observable<void>;

    public get peerId(): string {
        return this._connection.peer;
    }

    private constructor (connection: DataConnection) {
        this._connection = connection;

        this.onDataObservable = new Observable<any>();
        this._connection.on("data", (data) => {
            this.onDataObservable.notifyObservers(data);
        });

        this.onTerminatedObservable = new Observable<void>();
        this._connection.on("close", () => {
            this.onTerminatedObservable.notifyObservers();
        });
        this._connection.on("error", (error) => {
            console.error(error);
            this.onTerminatedObservable.notifyObservers();
        });
    }

    public static async CreateAsync(connection: DataConnection) {
        return await new Promise<AsyncDataConnection>((resolve) => {
            connection.on("open", () => {
                resolve(new AsyncDataConnection(connection));
            });
        });
    }

    public send(data: any) {
        this._connection.send(data);
    }

    public dispose() {
        this._connection.close();
    }
}

export class AsyncPeer {
    private _peer: Peer;

    public readonly onMediaConnectionObservable: Observable<AsyncMediaConnection>;
    public readonly onDataConnectionObservable: Observable<AsyncDataConnection>;

    public get id(): string {
        return this._peer.id;
    }

    private constructor(peer: Peer) {
        this._peer = peer;

        this.onMediaConnectionObservable = new Observable<AsyncMediaConnection>();
        this._peer.on("call", (mediaConnection: MediaConnection) => {
            this.onMediaConnectionObservable.notifyObservers(new AsyncMediaConnection(mediaConnection));
        });

        this.onDataConnectionObservable = new Observable<AsyncDataConnection>();
        this._peer.on("connection", (dataConnection: DataConnection) => {
            AsyncDataConnection.CreateAsync(dataConnection).then((connection) => {
                this.onDataConnectionObservable.notifyObservers(connection);
            });
        });
    }

    public static async CreateAsync(): Promise<AsyncPeer> {
        const jsPeer = new Peer();
        return new Promise<AsyncPeer>((resolve, reject) => {
            jsPeer.on("open", () => {
                resolve(new AsyncPeer(jsPeer));
            });
        });
    }

    public createMediaConnection(peerId: string, stream: MediaStream): AsyncMediaConnection {
        return new AsyncMediaConnection(this._peer.call(peerId, stream));
    }

    public async createDataConnectionAsync(peerId: string): Promise<AsyncDataConnection> {
        return await AsyncDataConnection.CreateAsync(this._peer.connect(peerId));
    }

    public dispose() {
        this._peer.destroy();
    }
}